// Model blend and ensemble ranges for arbitrary windows of hours.
//
// The blend is built hour by hour (mean of the models that cover that hour, nudged toward the
// ensemble mean at longer leads), so any window's blend is just a sum and days, buckets and
// "next 72h" always add up consistently. Ranges come from ensemble member totals for the
// window (P25–P75); without ensembles they fall back to the spread of the deterministic models.

import type { Confidence, ModelId, SnowAmount } from '../../shared/types';
import { snowFromPrecip } from './slr';

export type Hourly = (number | null)[];

export interface ModelSeries {
  precip: Hourly;
  temp: Hourly;
  snowRaw: Hourly;
  freezingFt: Hourly;
  wind: Hourly;
  gust: Hourly;
  windDir: Hourly;
  cloud: Hourly;
  pop: Hourly;
  /** Snow already forecast by the source (NWS forecasters); skips our temperature-based conversion. */
  snow?: Hourly;
}

export interface MemberSeries {
  precip: Hourly;
  temp: Hourly;
}

/** HRRR, NAM and NBM only count toward the blend in the first 48 hours. */
export const SHORT_RANGE_MODELS: ReadonlySet<ModelId> = new Set(['hrrr', 'nam', 'nbm']);
export const SHORT_RANGE_HOURS = 48;
/** A window needs this share of its hours covered to report a total. */
export const MIN_COVERAGE = 0.75;
/** Fewer members than this and the ensemble range isn't reported. */
export const MIN_MEMBERS = 10;
/**
 * Past a few days a single deterministic run is just one possible outcome, so the blend
 * leans on the ensemble mean: no weight through 72h, rising linearly to 70% at 168h.
 */
export const ENS_WEIGHT_START_H = 72;
export const ENS_WEIGHT_FULL_H = 168;
export const ENS_WEIGHT_MAX = 0.7;

export function ensembleWeight(leadHours: number): number {
  if (leadHours <= ENS_WEIGHT_START_H) return 0;
  const f = Math.min(1, (leadHours - ENS_WEIGHT_START_H) / (ENS_WEIGHT_FULL_H - ENS_WEIGHT_START_H));
  return f * ENS_WEIGHT_MAX;
}

/** Per-hour mean across ensemble members that have a value. */
export function memberMean(members: Hourly[], length: number): Hourly {
  const out: Hourly = new Array(length).fill(null);
  for (let h = 0; h < length; h++) {
    let sum = 0;
    let n = 0;
    for (const m of members) {
      const v = m[h];
      if (v !== null && v !== undefined) {
        sum += v;
        n++;
      }
    }
    out[h] = n >= MIN_MEMBERS ? sum / n : null;
  }
  return out;
}

/** Deterministic blend nudged toward the ensemble mean by lead time from `nowIdx`. */
export function weightWithEnsemble(det: Hourly, ensMean: Hourly, nowIdx: number): Hourly {
  return det.map((d, h) => {
    const e = ensMean[h];
    if (d === null || d === undefined) return e ?? null;
    if (e === null || e === undefined) return d;
    const w = ensembleWeight(h - nowIdx);
    return (1 - w) * d + w * e;
  });
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function hourlySnow(s: { precip: Hourly; temp: Hourly; snow?: Hourly }): Hourly {
  if (s.snow) return s.snow;
  return s.precip.map((p, i) => {
    const t = s.temp[i];
    return p === null || t === null || p === undefined || t === undefined ? null : snowFromPrecip(p, t);
  });
}

/** Sum over the window, or null if too few hours have data. */
export function windowSum(arr: Hourly, idx: number[], minCoverage = MIN_COVERAGE): number | null {
  if (idx.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const i of idx) {
    const v = arr[i];
    if (v !== null && v !== undefined) {
      sum += v;
      n++;
    }
  }
  return n / idx.length >= minCoverage ? sum : null;
}

export function windowStat(arr: Hourly, idx: number[], fn: 'min' | 'max' | 'mean'): number | null {
  const vals = idx.map((i) => arr[i]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  if (fn === 'min') return Math.min(...vals);
  if (fn === 'max') return Math.max(...vals);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Linear-interpolated percentile of a non-empty array (p in 0–100). */
export function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const pos = (p / 100) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const mean = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);

/**
 * Per-hour mean across models. `eligible(id, hour)` decides which models count at each hour.
 */
export function hourlyBlend(
  series: Partial<Record<ModelId, Hourly>>,
  length: number,
  eligible: (id: ModelId, hour: number) => boolean,
): Hourly {
  const out: Hourly = new Array(length).fill(null);
  for (let h = 0; h < length; h++) {
    const vals: number[] = [];
    for (const [id, arr] of Object.entries(series) as [ModelId, Hourly][]) {
      const v = arr[h];
      if (v !== null && v !== undefined && eligible(id, h)) vals.push(v);
    }
    out[h] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

export interface ElevSnowContext {
  blendSnow: Hourly;
  blendRaw: Hourly;
  modelSnow: Partial<Record<ModelId, Hourly>>;
  memberSnow: Hourly[];
  /** Last hour index (inclusive) where short-range models count. */
  shortRangeEnd: number;
}

/**
 * `minCoverage` is raised for running totals, where a model or member that stops partway
 * through the window would otherwise show up as a too-low total.
 */
export function snowAmount(idx: number[], ctx: ElevSnowContext, minCoverage = MIN_COVERAGE): SnowAmount {
  const blend = windowSum(ctx.blendSnow, idx, minCoverage);
  const raw = windowSum(ctx.blendRaw, idx, minCoverage);

  const models: Partial<Record<ModelId, number>> = {};
  for (const [id, arr] of Object.entries(ctx.modelSnow) as [ModelId, Hourly][]) {
    const total = windowSum(arr, idx, minCoverage);
    if (total !== null) models[id] = round1(total);
  }

  const memberTotals = ctx.memberSnow.map((m) => windowSum(m, idx, minCoverage)).filter((v): v is number => v !== null);

  let range: SnowAmount['range'] = null;
  let rangeSource: SnowAmount['rangeSource'] = null;
  let p10: number | null = null;
  let p90: number | null = null;

  if (memberTotals.length >= MIN_MEMBERS) {
    range = { lo: round1(percentile(memberTotals, 25)), hi: round1(percentile(memberTotals, 75)) };
    rangeSource = 'ensemble';
    p10 = round1(percentile(memberTotals, 10));
    p90 = round1(percentile(memberTotals, 90));
  } else {
    const withinShort = idx.length > 0 && Math.max(...idx) <= ctx.shortRangeEnd;
    const vals = (Object.entries(models) as [ModelId, number][])
      .filter(([id]) => withinShort || !SHORT_RANGE_MODELS.has(id))
      .map(([, v]) => v);
    if (vals.length >= 2) {
      range = { lo: Math.min(...vals), hi: Math.max(...vals) };
      rangeSource = 'models';
    }
  }

  // The headline number should never sit outside the range shown next to it.
  if (range && blend !== null) range = { lo: Math.min(range.lo, round1(blend)), hi: Math.max(range.hi, round1(blend)) };

  return {
    blend: blend === null ? null : round1(blend),
    range,
    rangeSource,
    p10,
    p90,
    models,
    rawBlend: raw === null ? null : round1(raw),
  };
}

/**
 * How much to trust a snow amount. Confident "little or nothing" counts as high.
 * Otherwise it's the interquartile spread relative to the median.
 */
export function confidenceOf(a: SnowAmount): Confidence | null {
  // A single model with nothing to compare against.
  if (!a.range) return a.blend === null ? null : 'low';
  const top = a.rangeSource === 'ensemble' ? (a.p90 ?? a.range.hi) : a.range.hi;
  if (top < 1) return 'high';
  const mid = Math.max((a.range.lo + a.range.hi) / 2, 1);
  const spread = (a.range.hi - a.range.lo) / mid;
  // Two deterministic models agreeing is weaker evidence than an ensemble agreeing.
  const penalty = a.rangeSource === 'models' ? 0.25 : 0;
  if (spread + penalty < 0.5) return 'high';
  if (spread + penalty < 1.0) return 'medium';
  return 'low';
}
