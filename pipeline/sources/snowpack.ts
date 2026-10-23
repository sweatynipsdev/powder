// Observed snowpack: SNOTEL (NRCS AWDB), CDEC snow pillows, or CoCoRaHS via ACIS.
// All three normalize to SnowpackData.

import type { SnowpackChange, SnowpackData } from '../../shared/types';
import type { ResortConfig } from '../config';
import { addDays, localDate, now } from '../clock';
import { fetchJson, qs } from '../http';

type SnowpackConfig = NonNullable<ResortConfig['snowpack']>;

/** Days of history to pull: enough for the 7-day change and a month-long sparkline. */
const HISTORY_DAYS = 30;

interface HourlyObs {
  /** Local "YYYY-MM-DD HH:MM". */
  t: string;
  depthIn: number | null;
  sweIn: number | null;
  tempF: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function minusHours(t: string, h: number): string {
  const d = new Date(`${t.replace(' ', 'T')}:00Z`);
  d.setUTCHours(d.getUTCHours() - h);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/** Latest non-null value at or before `t`, within `toleranceH` hours. */
function valueAt(obs: HourlyObs[], t: string, key: 'depthIn' | 'sweIn', toleranceH = 3): number | null {
  const earliest = minusHours(t, toleranceH);
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (o.t > t) continue;
    if (o.t < earliest) break;
    if (o[key] !== null) return o[key];
  }
  return null;
}

function change(obs: HourlyObs[], latestT: string, hours: number): SnowpackChange {
  const diff = (key: 'depthIn' | 'sweIn') => {
    const a = valueAt(obs, latestT, key);
    const b = valueAt(obs, minusHours(latestT, hours), key);
    return a === null || b === null ? null : round1(a - b);
  };
  return { depthIn: diff('depthIn'), sweIn: diff('sweIn') };
}

/** Builds SnowpackData from hourly observations sorted oldest → newest. */
export function summarizeHourly(cfg: SnowpackConfig, network: SnowpackData['station']['network'], url: string, raw: HourlyObs[]): SnowpackData {
  const obs = [...raw].sort((a, b) => a.t.localeCompare(b.t));
  const latest = [...obs].reverse().find((o) => o.depthIn !== null || o.sweIn !== null);
  if (!latest) throw new Error(`no recent observations from ${cfg.id}`);

  const byDate = new Map<string, { depthIn: number | null; sweIn: number | null }>();
  for (const o of obs) {
    const date = o.t.slice(0, 10);
    const cur = byDate.get(date) ?? { depthIn: null, sweIn: null };
    if (o.depthIn !== null) cur.depthIn = o.depthIn;
    if (o.sweIn !== null) cur.sweIn = o.sweIn;
    byDate.set(date, cur);
  }

  return {
    station: { id: cfg.id, name: cfg.name, network, elevFt: cfg.elevFt, url },
    observedAt: latest.t.replace(' ', 'T'),
    depthIn: valueAt(obs, latest.t, 'depthIn'),
    sweIn: valueAt(obs, latest.t, 'sweIn'),
    tempF: [...obs].reverse().find((o) => o.tempF !== null)?.tempF ?? null,
    change: { h24: change(obs, latest.t, 24), h48: change(obs, latest.t, 48), d7: change(obs, latest.t, 168) },
    newSnow: null,
    series: [...byDate.entries()].map(([date, v]) => ({ date, ...v })),
    note: null,
  };
}

// --- SNOTEL via AWDB ---------------------------------------------------------

interface AwdbStation {
  stationTriplet: string;
  data?: { stationElement: { elementCode: string }; values: { date: string; value: number | null }[] }[];
}

export function awdbUrl(id: string, begin: string, end: string): string {
  return `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?${qs({
    stationTriplets: id,
    elements: 'SNWD,WTEQ,TOBS',
    duration: 'HOURLY',
    beginDate: begin,
    endDate: end,
  })}`;
}

export function parseAwdb(cfg: SnowpackConfig, json: AwdbStation[]): SnowpackData {
  const st = json.find((s) => s.stationTriplet === cfg.id);
  if (!st?.data?.length) throw new Error(`AWDB returned no data for ${cfg.id}`);
  const rows = new Map<string, HourlyObs>();
  const row = (t: string) => {
    let r = rows.get(t);
    if (!r) rows.set(t, (r = { t, depthIn: null, sweIn: null, tempF: null }));
    return r;
  };
  for (const el of st.data) {
    const key = { SNWD: 'depthIn', WTEQ: 'sweIn', TOBS: 'tempF' }[el.stationElement.elementCode] as keyof HourlyObs | undefined;
    if (!key || key === 't') continue;
    for (const v of el.values) {
      if (v.value === null || v.value === undefined) continue;
      const r = row(v.date);
      if (key === 'tempF') r.tempF = Math.round(v.value);
      else r[key] = pillowValue(v.value, key === 'depthIn' ? 5 : 1);
    }
  }
  const sitenum = cfg.id.split(':')[0];
  return summarizeHourly(cfg, 'SNOTEL', `https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=${sitenum}`, [...rows.values()]);
}

// --- CDEC --------------------------------------------------------------------

interface CdecRow {
  SENSOR_NUM: number;
  date: string;
  value: number;
}

const CDEC_DEPTH = 18;
const CDEC_SWE = 3;
const CDEC_TEMP = 4;

export function cdecUrl(id: string, start: string, end: string): string {
  return `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?${qs({
    Stations: id,
    SensorNums: [CDEC_DEPTH, CDEC_SWE, CDEC_TEMP],
    dur_code: 'H',
    Start: start,
    End: end,
  })}`;
}

/** CDEC dates aren't zero-padded: "2026-9-23 0:00" → "2026-09-23 00:00". */
export function cdecDate(s: string): string | null {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const p = (v: string) => v.padStart(2, '0');
  return `${m[1]}-${p(m[2])}-${p(m[3])} ${p(m[4])}:${m[5]}`;
}

/**
 * Small negatives are sensor noise around zero; large ones (Mammoth Pass reads about −217″
 * off-season) mean the sensor isn't reporting a real value.
 */
function pillowValue(v: number, noiseFloor: number): number | null {
  if (v < -noiseFloor) return null;
  return Math.max(0, v);
}

export function parseCdec(cfg: SnowpackConfig, json: CdecRow[]): SnowpackData {
  if (!Array.isArray(json) || json.length === 0) throw new Error(`CDEC returned no data for ${cfg.id}`);
  const rows = new Map<string, HourlyObs>();
  for (const r of json) {
    const t = cdecDate(r.date);
    // CDEC marks missing values as -9999.
    if (!t || r.value === null || r.value <= -9000) continue;
    const o = rows.get(t) ?? { t, depthIn: null, sweIn: null, tempF: null };
    if (r.SENSOR_NUM === CDEC_DEPTH) o.depthIn = pillowValue(r.value, 5);
    else if (r.SENSOR_NUM === CDEC_SWE) {
      const swe = pillowValue(r.value, 1);
      o.sweIn = swe === null ? null : round1(swe);
    } else if (r.SENSOR_NUM === CDEC_TEMP) o.tempF = Math.round(r.value);
    rows.set(t, o);
  }
  return summarizeHourly(cfg, 'CDEC', `https://cdec.water.ca.gov/dynamicapp/staMeta?station_id=${cfg.id}`, [...rows.values()]);
}

// --- CoCoRaHS via ACIS -------------------------------------------------------

interface AcisResponse {
  data?: [string, string, string, string][];
  error?: string;
}

export const ACIS_URL = 'https://data.rcc-acis.org/StnData';

export function acisBody(id: string, sdate: string, edate: string): string {
  return JSON.stringify({ sid: id, sdate, edate, elems: 'snow,snwd,pcpn' });
}

/** ACIS id "US1CASR0098" → CoCoRaHS station "CA-SR-98". */
export function cocorahsStation(id: string): string {
  const m = id.match(/^US1([A-Z]{2})([A-Z]{2})0*(\d+)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : id;
}

/** "T" is a trace (counts as 0); "M" is missing. */
function acisValue(v: string): number | null {
  if (v === 'T') return 0;
  const n = Number(v);
  return v === 'M' || v === '' || Number.isNaN(n) ? null : n;
}

export function parseAcis(cfg: SnowpackConfig, json: AcisResponse, today: string): SnowpackData {
  if (json.error) throw new Error(`ACIS: ${json.error}`);
  const days = (json.data ?? []).map(([date, snow, snwd]) => ({ date, snow: acisValue(snow), depth: acisValue(snwd) }));
  const reported = days.filter((d) => d.snow !== null || d.depth !== null);
  const last = reported.at(-1);
  if (!last) throw new Error(`no recent CoCoRaHS reports from ${cfg.id}`);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const sumSnow = (n: number) => {
    let total = 0;
    let any = false;
    for (let i = 0; i < n; i++) {
      const v = byDate.get(addDays(last.date, -i))?.snow;
      if (v !== null && v !== undefined) {
        total += v;
        any = true;
      }
    }
    return any ? round1(total) : null;
  };
  const depthOn = (date: string) => byDate.get(date)?.depth ?? null;
  const depthChange = (n: number) => {
    const a = last.depth;
    const b = depthOn(addDays(last.date, -n));
    return a === null || b === null ? null : round1(a - b);
  };
  const lagDays = Math.round((Date.parse(today) - Date.parse(last.date)) / 86_400_000);

  return {
    station: {
      id: cfg.id,
      name: cfg.name,
      network: 'CoCoRaHS',
      elevFt: cfg.elevFt,
      url: `https://dex.cocorahs.org/stations/${cocorahsStation(cfg.id)}`,
    },
    observedAt: `${last.date}T07:00`,
    depthIn: last.depth,
    sweIn: null,
    tempF: null,
    change: {
      h24: { depthIn: depthChange(1), sweIn: null },
      h48: { depthIn: depthChange(2), sweIn: null },
      d7: { depthIn: depthChange(7), sweIn: null },
    },
    newSnow: { h24: sumSnow(1), h48: sumSnow(2), d7: sumSnow(7) },
    series: days.map((d) => ({ date: d.date, depthIn: d.depth, sweIn: null, newIn: d.snow })),
    note: `Volunteer observer in town (${cfg.elevFt.toLocaleString('en-US')} ft), reported each morning${lagDays > 1 ? `; latest report is ${lagDays} days old` : ''}.`,
  };
}

// --- Dispatch ----------------------------------------------------------------

export async function fetchSnowpack(r: ResortConfig): Promise<SnowpackData> {
  const cfg = r.snowpack;
  if (!cfg) throw new Error('no snowpack source configured');
  const today = localDate(now(), r.tz);
  const begin = addDays(today, -HISTORY_DAYS);
  switch (cfg.type) {
    case 'awdb':
      return parseAwdb(cfg, await fetchJson<AwdbStation[]>(awdbUrl(cfg.id, begin, addDays(today, 1))));
    case 'cdec':
      return parseCdec(cfg, await fetchJson<CdecRow[]>(cdecUrl(cfg.id, begin, addDays(today, 1))));
    case 'acis':
      return parseAcis(
        cfg,
        await fetchJson<AcisResponse>(ACIS_URL, {
          method: 'POST',
          body: acisBody(cfg.id, begin, today),
          headers: { 'Content-Type': 'application/json' },
        }),
        today,
      );
  }
}
