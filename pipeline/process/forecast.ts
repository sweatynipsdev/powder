// Turns raw model + ensemble series into the ForecastData the app and the analysis read.

import type {
  DaySummary,
  Elev,
  ForecastData,
  HourlyData,
  ModelCalibration,
  ModelId,
  ModelInfo,
  Period,
  SnowAmount,
  SnowQuality,
  WeatherIcon,
} from '../../shared/types';
import { ELEVS } from '../../shared/types';
import type { NwsGrid } from '../sources/nwsGrid';
import type { DeterministicResult, EnsembleResult } from '../sources/openMeteo';
import {
  confidenceOf,
  type ElevSnowContext,
  type Hourly,
  hourlyBlend,
  hourlySnow,
  memberMean,
  type ModelSeries,
  SHORT_RANGE_HOURS,
  SHORT_RANGE_MODELS,
  snowAmount,
  weightWithEnsemble,
  windowStat,
  windowSum,
} from './blend';
import { buildPeriods, windowHours } from './periods';
import { rainFromPrecip, snowFraction } from './slr';

/** Snow typically sticks about this far below the freezing level. */
export const SNOW_LEVEL_BELOW_FREEZING_FT = 1000;
/** Rain at the base worth flagging, inches of liquid. */
export const RAIN_AT_BASE_IN = 0.05;
export const HOURLY_HOURS = 72;

export interface ForecastInput {
  det: DeterministicResult;
  ens: EnsembleResult | null;
  /** The NWS forecasters' grids near the base and the summit, when available. */
  nws?: Record<Elev, NwsGrid | null> | null;
  /** Local-model corrections to apply, by model. */
  calibration?: Partial<Record<ModelId, ModelCalibration>>;
  /** Local "now", e.g. 2026-10-23T05:20 (from clock.localIso). */
  nowLocal: string;
  days: number;
}

const round100 = (n: number) => Math.round(n / 100) * 100;
const nulls = (n: number): Hourly => new Array(n).fill(null);

/** Re-index ensemble member arrays onto the deterministic time axis. */
function alignMembers(ens: EnsembleResult | null, elev: Elev, times: string[]) {
  if (!ens) return [];
  const pos = new Map(ens.times.map((t, i) => [t, i]));
  const map = times.map((t) => pos.get(t));
  return ens.elevs[elev].map((m) => ({
    precip: map.map((i) => (i === undefined ? null : m.precip[i])),
    temp: map.map((i) => (i === undefined ? null : m.temp[i])),
  }));
}

/** The NWS grid as one more "model": its own snowfall, precipitation and precip chance. */
function nwsSeries(grid: NwsGrid, n: number): ModelSeries {
  return {
    precip: grid.precip,
    temp: nulls(n),
    snowRaw: [],
    freezingFt: [],
    wind: [],
    gust: [],
    windDir: [],
    cloud: [],
    pop: grid.pop,
    snow: grid.snow,
  };
}

/** Per-hour circular mean of wind direction across models. */
function hourlyDirection(series: Partial<Record<ModelId, Hourly>>, n: number, eligible: (id: ModelId, h: number) => boolean): Hourly {
  const out: Hourly = nulls(n);
  for (let h = 0; h < n; h++) {
    let x = 0;
    let y = 0;
    let k = 0;
    for (const [id, arr] of Object.entries(series) as [ModelId, Hourly][]) {
      const d = arr[h];
      if (d === null || d === undefined || !eligible(id, h)) continue;
      x += Math.cos((d * Math.PI) / 180);
      y += Math.sin((d * Math.PI) / 180);
      k++;
    }
    if (k) out[h] = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }
  return out;
}

interface ElevWork {
  ctx: ElevSnowContext;
  temp: Hourly;
  precip: Hourly;
  rain: Hourly;
  freezingFt: Hourly;
  wind: Hourly;
  gust: Hourly;
  windDir: Hourly;
  cloud: Hourly;
  pop: Hourly;
}

function prepareElev(input: ForecastInput, elev: Elev, nowIdx: number): ElevWork {
  const { det } = input;
  const n = det.times.length;
  const shortRangeEnd = nowIdx + SHORT_RANGE_HOURS;
  const eligible = (id: ModelId, h: number) => !SHORT_RANGE_MODELS.has(id) || h <= shortRangeEnd;

  const grid = input.nws?.[elev];
  const models: Partial<Record<ModelId, ModelSeries>> = { ...det.elevs[elev], ...(grid ? { nws: nwsSeries(grid, n) } : {}) };
  const pick = (key: 'precip' | 'temp' | 'snowRaw' | 'freezingFt' | 'wind' | 'gust' | 'windDir' | 'cloud' | 'pop') =>
    Object.fromEntries(Object.entries(models).map(([id, s]) => [id, s[key]])) as Partial<Record<ModelId, Hourly>>;

  // A model's learned local bias (from forecast-vs-observed history) scales its snow.
  const modelSnow = Object.fromEntries(
    Object.entries(models).map(([id, s]) => {
      const factor = input.calibration?.[id as ModelId]?.factor ?? 1;
      const snow = hourlySnow(s);
      return [id, factor === 1 ? snow : snow.map((v) => (v === null ? null : v * factor))];
    }),
  ) as Partial<Record<ModelId, Hourly>>;
  const modelRain = Object.fromEntries(
    Object.entries(models).map(([id, s]) => [
      id,
      s.precip.map((p, i) => (p === null || s.temp[i] === null || s.temp[i] === undefined ? null : rainFromPrecip(p, s.temp[i]!))),
    ]),
  ) as Partial<Record<ModelId, Hourly>>;

  const memberSnow = alignMembers(input.ens, elev, det.times).map(hourlySnow);

  return {
    ctx: {
      blendSnow: weightWithEnsemble(hourlyBlend(modelSnow, n, eligible), memberMean(memberSnow, n), nowIdx),
      blendRaw: hourlyBlend(pick('snowRaw'), n, eligible),
      modelSnow,
      memberSnow,
      shortRangeEnd,
    },
    temp: hourlyBlend(pick('temp'), n, eligible),
    precip: hourlyBlend(pick('precip'), n, eligible),
    rain: hourlyBlend(modelRain, n, eligible),
    freezingFt: hourlyBlend(pick('freezingFt'), n, eligible),
    wind: hourlyBlend(pick('wind'), n, eligible),
    gust: hourlyBlend(pick('gust'), n, eligible),
    windDir: hourlyDirection(pick('windDir'), n, eligible),
    cloud: hourlyBlend(pick('cloud'), n, eligible),
    pop: hourlyBlend(pick('pop'), n, eligible),
  };
}

/** Running totals only count a model or member that covers essentially the whole span. */
export const CUMULATIVE_COVERAGE = 0.95;

function snowBoth(work: Record<Elev, ElevWork>, idx: number[], minCoverage?: number): Record<Elev, SnowAmount> {
  return { summit: snowAmount(idx, work.summit.ctx, minCoverage), base: snowAmount(idx, work.base.ctx, minCoverage) };
}

function temps(work: Record<Elev, ElevWork>, idx: number[]) {
  const t = (e: Elev, fn: 'min' | 'max') => {
    const v = windowStat(work[e].temp, idx, fn);
    return v === null ? null : Math.round(v);
  };
  return {
    summit: { min: t('summit', 'min'), max: t('summit', 'max') },
    base: { min: t('base', 'min'), max: t('base', 'max') },
  };
}

/** Snow-to-liquid ratio for a window, when there's enough snow for it to mean something. */
export function windowSlr(snow: number | null, precip: number | null): number | null {
  if (snow === null || precip === null || precip < 0.05 || snow < 0.5) return null;
  return Math.round(snow / precip);
}

/** Lighter, drier snow has a higher ratio. */
export function qualityOf(slr: number | null): SnowQuality | null {
  if (slr === null) return null;
  if (slr >= 15) return 'excellent';
  if (slr >= 11) return 'good';
  return 'okay';
}

/** Precipitation type from temperature, otherwise sky cover. */
export function iconFor(precipIn: number | null, tempF: number | null, cloudPct: number | null, threshold: number): WeatherIcon {
  if (precipIn !== null && precipIn >= threshold && tempF !== null) {
    const f = snowFraction(tempF);
    return f >= 0.8 ? 'snow' : f <= 0.2 ? 'rain' : 'mix';
  }
  if (cloudPct === null) return 'partly';
  return cloudPct < 25 ? 'clear' : cloudPct < 70 ? 'partly' : 'cloudy';
}

const rounded = (v: number | null, digits = 0) => (v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

function buildHourly(work: Record<Elev, ElevWork>, times: string[], nowIdx: number): HourlyData {
  const idx = Array.from({ length: HOURLY_HOURS }, (_, k) => nowIdx + 1 + k).filter((i) => i < times.length);
  const s = work.summit;
  const snowAt = (e: Elev, i: number) => rounded(work[e].ctx.blendSnow[i] ?? null, 1);
  return {
    time: idx.map((i) => times[i]),
    tempF: {
      summit: idx.map((i) => rounded(s.temp[i] ?? null)),
      base: idx.map((i) => rounded(work.base.temp[i] ?? null)),
    },
    snowIn: { summit: idx.map((i) => snowAt('summit', i)), base: idx.map((i) => snowAt('base', i)) },
    precipIn: idx.map((i) => rounded(s.precip[i] ?? null, 2)),
    slr: idx.map((i) => {
      const p = s.precip[i] ?? null;
      const sn = s.ctx.blendSnow[i] ?? null;
      return p !== null && sn !== null && p >= 0.005 && sn > 0.05 ? Math.round(sn / p) : null;
    }),
    popPct: idx.map((i) => rounded(s.pop[i] ?? null)),
    snowLevelFt: idx.map((i) => {
      const f = s.freezingFt[i] ?? null;
      return f === null ? null : round100(Math.max(0, f - SNOW_LEVEL_BELOW_FREEZING_FT));
    }),
    windMph: idx.map((i) => rounded(s.wind[i] ?? null)),
    gustMph: idx.map((i) => rounded(s.gust[i] ?? null)),
    windDir: idx.map((i) => s.windDir[i] ?? null),
    cloudPct: idx.map((i) => rounded(s.cloud[i] ?? null)),
    icon: idx.map((i) => iconFor(s.precip[i] ?? null, s.temp[i] ?? null, s.cloud[i] ?? null, 0.01)),
  };
}

/** Circular mean of a window of directions. */
function meanDirection(dirs: Hourly, idx: number[]): number | null {
  let x = 0;
  let y = 0;
  let k = 0;
  for (const i of idx) {
    const d = dirs[i];
    if (d === null || d === undefined) continue;
    x += Math.cos((d * Math.PI) / 180);
    y += Math.sin((d * Math.PI) / 180);
    k++;
  }
  return k ? Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) : null;
}

export function buildForecast(input: ForecastInput): ForecastData {
  const { det, nowLocal, days } = input;
  const times = det.times;
  const firstDate = times[0].slice(0, 10);
  // Index of the last hour that has already ended.
  let nowIdx = times.findIndex((t) => t > nowLocal) - 1;
  if (nowIdx < 0) nowIdx = 0;

  const work = Object.fromEntries(ELEVS.map((e) => [e, prepareElev(input, e, nowIdx)])) as Record<Elev, ElevWork>;
  const slots = buildPeriods(times, firstDate, days);

  const periods: Period[] = slots.map((slot) => {
    const idx = slot.hours;
    const freezing = windowStat(work.summit.freezingFt, idx, 'mean');
    const baseRain = windowSum(work.base.rain, idx);
    const wind = windowStat(work.summit.wind, idx, 'max');
    const gust = windowStat(work.summit.gust, idx, 'max');
    const snow = snowBoth(work, idx);
    const precip = { summit: windowSum(work.summit.precip, idx), base: windowSum(work.base.precip, idx) };
    const slr = { summit: windowSlr(snow.summit.blend, precip.summit), base: windowSlr(snow.base.blend, precip.base) };
    const pop = windowStat(work.summit.pop, idx, 'max');
    const cloud = windowStat(work.summit.cloud, idx, 'mean');
    return {
      kind: slot.kind,
      date: slot.date,
      start: slot.start,
      end: slot.end,
      label: slot.label,
      snow,
      precipIn: precip.summit === null ? null : Math.round(precip.summit * 100) / 100,
      tempF: temps(work, idx),
      freezingLevelFt: freezing === null ? null : round100(freezing),
      snowLevelFt: freezing === null ? null : round100(Math.max(0, freezing - SNOW_LEVEL_BELOW_FREEZING_FT)),
      windMph: wind === null ? null : Math.round(wind),
      gustMph: gust === null ? null : Math.round(gust),
      windDir: meanDirection(work.summit.windDir, idx),
      popPct: pop === null ? null : Math.round(pop),
      cloudPct: cloud === null ? null : Math.round(cloud),
      icon: iconFor(precip.summit, windowStat(work.summit.temp, idx, 'mean'), cloud, 0.04),
      slr,
      quality: { summit: qualityOf(slr.summit), base: qualityOf(slr.base) },
      rainAtBase: baseRain !== null && baseRain >= RAIN_AT_BASE_IN,
    };
  });

  const dayList: DaySummary[] = [];
  for (let d = 0; d < days; d++) {
    const [day, night] = [slots[2 * d], slots[2 * d + 1]];
    const idx = [...day.hours, ...night.hours];
    const snow = snowBoth(work, idx);
    const levels = [periods[2 * d].snowLevelFt, periods[2 * d + 1].snowLevelFt].filter((v): v is number => v !== null);
    const gusts = [periods[2 * d].gustMph, periods[2 * d + 1].gustMph].filter((v): v is number => v !== null);
    dayList.push({
      date: day.date,
      label: day.label,
      snow,
      confidence: confidenceOf(snow.summit),
      tempF: temps(work, idx),
      snowLevelFt: { min: levels.length ? Math.min(...levels) : null, max: levels.length ? Math.max(...levels) : null },
      gustMph: gusts.length ? Math.max(...gusts) : null,
    });
  }

  const nowStamp = times[nowIdx];
  const bucketHours = (from: number, to: number) => slots.filter((s) => s.dayIndex >= from && s.dayIndex <= to).flatMap((s) => s.hours);
  const cumulative = dayList.map((d, i) => ({ date: d.date, ...snowBoth(work, bucketHours(0, i), CUMULATIVE_COVERAGE) }));

  const nws = input.nws;
  const nwsHours = nws?.summit?.snow.filter((v) => v !== null).length ?? nws?.base?.snow.filter((v) => v !== null).length ?? 0;
  const models: ModelInfo[] = nws && (nws.summit || nws.base) ? [...det.models, { id: 'nws', label: 'NWS forecasters', hours: nwsHours }] : det.models;

  return {
    startsAt: slots[0].start,
    windowsFrom: nowStamp,
    models,
    ensembles: input.ens?.ensembles ?? [],
    periods,
    days: dayList,
    hourly: buildHourly(work, times, nowIdx),
    nwsGridFt: nws ? { summit: nws.summit?.elevationFt ?? null, base: nws.base?.elevationFt ?? null } : null,
    calibration: input.calibration ?? {},
    cumulative,
    windows: {
      next24h: snowBoth(work, windowHours(times, nowStamp, 24)),
      next72h: snowBoth(work, windowHours(times, nowStamp, 72)),
      next7d: snowBoth(work, windowHours(times, nowStamp, 168)),
    },
    buckets: {
      d1_5: snowBoth(work, bucketHours(0, 4)),
      d6_10: snowBoth(work, bucketHours(5, 9)),
      d11_16: snowBoth(work, bucketHours(10, 15)),
    },
  };
}
