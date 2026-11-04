// The "local model": every run logs what each model forecast and what was observed, and
// calibration learns each mountain's per-model bias from those logs. With enough snow
// events, a model that runs 30% low at Mammoth gets scaled up at Mammoth only. The same
// log gives the app each resort's own reported snow for the days before today.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DaySnow, ModelCalibration, ModelId, ResortData } from '../shared/types';
import { addDays, localDate, localIso } from './clock';

export const HISTORY_DAYS = 7;
/** Snow events needed before a model's correction is trusted. */
export const MIN_EVENTS = 6;
/** A day counts as an event when the forecast or the observation reached this, inches. */
export const EVENT_IN = 2;
export const FACTOR_RANGE: [number, number] = [0.6, 1.6];

export interface ForecastSnapshot {
  at: string;
  /** Local date and hour of the run. */
  local: string;
  resort: string;
  /** Summit totals for the next 7 days (5am-5am), by day. */
  days: { date: string; blend: number | null; models: Partial<Record<ModelId, number>> }[];
}

export interface Observation {
  at: string;
  local: string;
  resort: string;
  /** Resort-reported new snow, last 24h, only when the report is current. */
  reportH24: number | null;
  /** When the resort updated that report. Missing from rows logged before 2026-11-04. */
  reportAt?: string | null;
  /** Volunteer-observed new snow (CoCoRaHS), last 24h. */
  stationNew24: number | null;
  /** Snow-depth change at the station, last 24h (settles, so it undercounts). */
  depthChange24: number | null;
}

export function snapshot(r: ResortData, at: Date): ForecastSnapshot | null {
  const f = r.forecast.data;
  if (!f || !r.forecast.status.ok) return null;
  return {
    at: at.toISOString(),
    local: localIso(at, r.tz),
    resort: r.id,
    days: f.days.slice(0, HISTORY_DAYS).map((d) => ({ date: d.date, blend: d.snow.summit.blend, models: d.snow.summit.models })),
  };
}

export function observation(r: ResortData, at: Date): Observation {
  const rep = r.report?.status.ok ? r.report.data : null;
  const sp = r.snowpack?.status.ok ? r.snowpack.data : null;
  return {
    at: at.toISOString(),
    local: localIso(at, r.tz),
    resort: r.id,
    reportH24: rep?.fresh ? rep.h24 : null,
    reportAt: rep?.fresh ? rep.updatedAt : null,
    stationNew24: sp?.newSnow?.h24 ?? null,
    depthChange24: sp?.change.h24.depthIn ?? null,
  };
}

const month = (at: Date) => at.toISOString().slice(0, 7);

export function appendHistory(dir: string, resorts: ResortData[], at: Date): void {
  mkdirSync(dir, { recursive: true });
  const snaps = resorts.map((r) => snapshot(r, at)).filter((s): s is ForecastSnapshot => !!s);
  if (snaps.length) appendFileSync(join(dir, `forecasts-${month(at)}.jsonl`), snaps.map((s) => JSON.stringify(s)).join('\n') + '\n');
  appendFileSync(join(dir, `observed-${month(at)}.jsonl`), resorts.map((r) => JSON.stringify(observation(r, at))).join('\n') + '\n');
}

/** Every `<prefix>YYYY-MM.jsonl` file, or only those from `fromMonth` on. */
function readJsonl<T>(dir: string, prefix: string, fromMonth?: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl') && (!fromMonth || f >= `${prefix}${fromMonth}`))
    .sort()
    .flatMap((f) =>
      readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as T),
    );
}

export const loadSnapshots = (dir: string) => readJsonl<ForecastSnapshot>(dir, 'forecasts-');
export const loadObservations = (dir: string, fromMonth?: string) => readJsonl<Observation>(dir, 'observed-', fromMonth);

const localHour = (local: string) => Number(local.slice(11, 13));
const isMorning = (local: string) => localHour(local) < 12;

/** Best available truth for the 24h ending the morning of an observation. */
export function observedSnow(o: Observation): number | null {
  if (o.reportH24 !== null) return o.reportH24;
  if (o.stationNew24 !== null) return o.stationNew24;
  return o.depthChange24 !== null ? Math.max(0, o.depthChange24) : null;
}

/**
 * The resort's own reported new snow on each of the `days` days before `today`, dated by the
 * morning it was reported: the 24h ending then, like "Last 24 Hours", which today's report fills.
 * The report's own time dates it. Rows logged before `reportAt` existed use the run's time,
 * where a run before 5am still holds the previous morning's report. When several runs saw a
 * report for the same day, the latest run wins.
 */
export function reportedSnowByDay(obs: Observation[], tz: string, today: string, days = HISTORY_DAYS): DaySnow[] {
  const byDay = new Map<string, number>();
  for (const o of [...obs].sort((a, b) => a.at.localeCompare(b.at))) {
    if (o.reportH24 === null) continue;
    let day: string;
    if (o.reportAt) day = localDate(new Date(o.reportAt), tz);
    else day = localHour(o.local) < 5 ? addDays(o.local.slice(0, 10), -1) : o.local.slice(0, 10);
    if (day >= addDays(today, -days) && day < today) byDay.set(day, o.reportH24);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, inches]) => ({ date, inches }));
}

export type Calibration = Record<string, Partial<Record<ModelId, ModelCalibration>>>;

/**
 * Pairs each morning observation (snow in the 24h ending that morning) with the forecasts
 * for that same 5am-5am window made one and two mornings earlier, then learns a per-model
 * multiplier from snow events. Models without enough events are left out (factor 1).
 */
export function computeCalibration(snaps: ForecastSnapshot[], obs: Observation[]): Calibration {
  const morningSnaps = new Map<string, ForecastSnapshot>();
  for (const s of snaps) if (isMorning(s.local)) morningSnaps.set(`${s.resort}|${s.local.slice(0, 10)}`, s);

  // Extra runs (a push to main, a manual run) log extra mornings; count each morning once.
  const mornings = new Map<string, Observation>();
  for (const o of obs) if (isMorning(o.local)) mornings.set(`${o.resort}|${o.local.slice(0, 10)}`, o);

  const sums: Record<string, Partial<Record<ModelId, { obs: number; fcst: number; events: number }>>> = {};
  for (const o of mornings.values()) {
    const truth = observedSnow(o);
    if (truth === null) continue;
    const today = o.local.slice(0, 10);
    const day = addDays(today, -1);
    for (const lead of [1, 2]) {
      const snap = morningSnaps.get(`${o.resort}|${addDays(today, -lead)}`);
      const fc = snap?.days.find((d) => d.date === day);
      if (!fc) continue;
      if (Math.max(truth, fc.blend ?? 0) < EVENT_IN) continue;
      for (const [id, v] of Object.entries(fc.models) as [ModelId, number][]) {
        const acc = ((sums[o.resort] ??= {})[id] ??= { obs: 0, fcst: 0, events: 0 });
        acc.obs += truth;
        acc.fcst += v;
        acc.events++;
      }
    }
  }

  const out: Calibration = {};
  for (const [resort, models] of Object.entries(sums)) {
    for (const [id, a] of Object.entries(models) as [ModelId, { obs: number; fcst: number; events: number }][]) {
      if (a.events < MIN_EVENTS || a.fcst < EVENT_IN * 2) continue;
      const factor = Math.min(FACTOR_RANGE[1], Math.max(FACTOR_RANGE[0], a.obs / a.fcst));
      (out[resort] ??= {})[id] = { factor: Math.round(factor * 100) / 100, events: a.events };
    }
  }
  return out;
}

export function loadCalibration(path: string): Calibration {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')).resorts as Calibration) : {};
  } catch {
    return {};
  }
}

export function writeCalibration(path: string, cal: Calibration, at: Date): void {
  writeFileSync(path, JSON.stringify({ generatedAt: at.toISOString(), minEvents: MIN_EVENTS, resorts: cal }, null, 2) + '\n');
}
