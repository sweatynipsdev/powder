// Turns raw model + ensemble series into the ForecastData the app and the analysis read.

import type { DaySummary, Elev, ForecastData, ModelId, Period, SnowAmount } from '../../shared/types';
import { ELEVS } from '../../shared/types';
import type { DeterministicResult, EnsembleResult } from '../sources/openMeteo';
import {
  confidenceOf,
  type ElevSnowContext,
  type Hourly,
  hourlyBlend,
  hourlySnow,
  memberMean,
  SHORT_RANGE_HOURS,
  SHORT_RANGE_MODELS,
  snowAmount,
  weightWithEnsemble,
  windowStat,
  windowSum,
} from './blend';
import { buildPeriods, windowHours } from './periods';
import { rainFromPrecip } from './slr';

/** Snow typically sticks about this far below the freezing level. */
export const SNOW_LEVEL_BELOW_FREEZING_FT = 1000;
/** Rain at the base worth flagging, inches of liquid. */
export const RAIN_AT_BASE_IN = 0.05;

export interface ForecastInput {
  det: DeterministicResult;
  ens: EnsembleResult | null;
  /** Local "now", e.g. 2026-10-23T05:20 (from clock.localIso). */
  nowLocal: string;
  days: number;
}

const round100 = (n: number) => Math.round(n / 100) * 100;

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

interface ElevWork {
  ctx: ElevSnowContext;
  temp: Hourly;
  precip: Hourly;
  rain: Hourly;
  freezingFt: Hourly;
  wind: Hourly;
  gust: Hourly;
}

function prepareElev(input: ForecastInput, elev: Elev, nowIdx: number): ElevWork {
  const { det } = input;
  const n = det.times.length;
  const shortRangeEnd = nowIdx + SHORT_RANGE_HOURS;
  const eligible = (id: ModelId, h: number) => !SHORT_RANGE_MODELS.has(id) || h <= shortRangeEnd;

  const models = det.elevs[elev];
  const pick = (key: 'precip' | 'temp' | 'snowRaw' | 'freezingFt' | 'wind' | 'gust') =>
    Object.fromEntries(Object.entries(models).map(([id, s]) => [id, s[key]])) as Partial<Record<ModelId, Hourly>>;

  const modelSnow = Object.fromEntries(
    Object.entries(models).map(([id, s]) => [id, hourlySnow(s)]),
  ) as Partial<Record<ModelId, Hourly>>;
  const modelRain = Object.fromEntries(
    Object.entries(models).map(([id, s]) => [
      id,
      s.precip.map((p, i) => (p === null || s.temp[i] === null ? null : rainFromPrecip(p, s.temp[i]!))),
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
    const precip = windowSum(work.summit.precip, idx);
    const baseRain = windowSum(work.base.rain, idx);
    const wind = windowStat(work.summit.wind, idx, 'max');
    const gust = windowStat(work.summit.gust, idx, 'max');
    return {
      kind: slot.kind,
      date: slot.date,
      start: slot.start,
      end: slot.end,
      label: slot.label,
      snow: snowBoth(work, idx),
      precipIn: precip === null ? null : Math.round(precip * 100) / 100,
      tempF: temps(work, idx),
      freezingLevelFt: freezing === null ? null : round100(freezing),
      snowLevelFt: freezing === null ? null : round100(Math.max(0, freezing - SNOW_LEVEL_BELOW_FREEZING_FT)),
      windMph: wind === null ? null : Math.round(wind),
      gustMph: gust === null ? null : Math.round(gust),
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

  return {
    startsAt: slots[0].start,
    windowsFrom: nowStamp,
    models: det.models,
    ensembles: input.ens?.ensembles ?? [],
    periods,
    days: dayList,
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
