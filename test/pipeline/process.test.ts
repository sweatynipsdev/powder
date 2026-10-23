import { describe, expect, it } from 'vitest';
import {
  confidenceOf,
  ensembleWeight,
  type ElevSnowContext,
  type Hourly,
  hourlyBlend,
  memberMean,
  percentile,
  snowAmount,
  weightWithEnsemble,
  windowSum,
} from '../../pipeline/process/blend';
import { buildPeriods, windowHours } from '../../pipeline/process/periods';
import { carryForward } from '../../pipeline/process/stale';
import { rainFromPrecip, snowFraction, snowFromPrecip, snowRatio } from '../../pipeline/process/slr';
import type { SnowAmount, Sourced } from '../../shared/types';

describe('snow-to-liquid ratio', () => {
  it('interpolates the table and clamps at the ends', () => {
    expect(snowRatio(40)).toBe(6);
    expect(snowRatio(32)).toBe(8);
    expect(snowRatio(30)).toBe(9);
    expect(snowRatio(28)).toBe(10);
    expect(snowRatio(-20)).toBe(17);
  });

  it('splits rain and snow between 32°F and 35°F', () => {
    expect(snowFraction(30)).toBe(1);
    expect(snowFraction(33.5)).toBeCloseTo(0.5);
    expect(snowFraction(36)).toBe(0);
    expect(rainFromPrecip(1, 33.5) + snowFraction(33.5)).toBeCloseTo(1);
  });

  it('turns an inch of water into ~10" at 28°F and nothing when it rains', () => {
    expect(snowFromPrecip(1, 28)).toBe(10);
    expect(snowFromPrecip(1, 40)).toBe(0);
    expect(snowFromPrecip(0, 10)).toBe(0);
  });

  it('beats Open-Meteo’s fixed 7:1 ratio in a cold storm', () => {
    expect(snowFromPrecip(1, 20)).toBeGreaterThan(7);
  });
});

describe('periods', () => {
  // Two days of hourly stamps starting at local midnight.
  const times = Array.from({ length: 48 }, (_, i) => {
    const day = i < 24 ? '2026-10-23' : '2026-10-24';
    return `${day}T${String(i % 24).padStart(2, '0')}:00`;
  });

  it('uses hour-ending stamps: day = 06:00–17:00, night = 18:00–05:00 next day', () => {
    const [day, night] = buildPeriods(times, '2026-10-23', 1);
    expect(day.label).toBe('Fri');
    expect(times[day.hours[0]]).toBe('2026-10-23T06:00');
    expect(times[day.hours.at(-1)!]).toBe('2026-10-23T17:00');
    expect(day.hours).toHaveLength(12);
    expect(night.label).toBe('Fri night');
    expect(times[night.hours[0]]).toBe('2026-10-23T18:00');
    expect(times[night.hours.at(-1)!]).toBe('2026-10-24T05:00');
    expect(night.end).toBe('2026-10-24T05:00');
  });

  it('drops hours past the end of the data', () => {
    const slots = buildPeriods(times, '2026-10-23', 2);
    expect(slots[3].hours).toHaveLength(6); // Sat night has 18:00–23:00 only
  });

  it('windows start after "now"', () => {
    const idx = windowHours(times, '2026-10-23T09:00', 3);
    expect(idx.map((i) => times[i])).toEqual(['2026-10-23T10:00', '2026-10-23T11:00', '2026-10-23T12:00']);
  });
});

describe('blend helpers', () => {
  it('windowSum needs 75% coverage', () => {
    expect(windowSum([1, 1, 1, null], [0, 1, 2, 3])).toBe(3);
    expect(windowSum([1, null, null, null], [0, 1, 2, 3])).toBeNull();
    expect(windowSum([1, 2], [])).toBeNull();
  });

  it('percentile interpolates', () => {
    expect(percentile([0, 10], 25)).toBe(2.5);
    expect(percentile([5, 1, 3], 50)).toBe(3);
  });

  it('hourlyBlend averages only eligible models', () => {
    const out = hourlyBlend({ gfs: [2, 2], hrrr: [4, 4] }, 2, (id, h) => id !== 'hrrr' || h === 0);
    expect(out).toEqual([3, 2]);
  });

  it('ensemble weight ramps from 0 at 72h to 0.7 at 168h', () => {
    expect(ensembleWeight(24)).toBe(0);
    expect(ensembleWeight(72)).toBe(0);
    expect(ensembleWeight(120)).toBeCloseTo(0.35);
    expect(ensembleWeight(168)).toBeCloseTo(0.7);
    expect(ensembleWeight(300)).toBeCloseTo(0.7);
  });

  it('weightWithEnsemble leaves short range alone and leans on the ensemble later', () => {
    const det: Hourly = new Array(200).fill(1);
    const ens: Hourly = new Array(200).fill(0);
    const out = weightWithEnsemble(det, ens, 0);
    expect(out[10]).toBe(1);
    expect(out[190]).toBeCloseTo(0.3);
  });

  it('memberMean needs enough members', () => {
    const members = Array.from({ length: 12 }, (_, i) => [i] as Hourly);
    expect(memberMean(members, 1)[0]).toBeCloseTo(5.5);
    expect(memberMean(members.slice(0, 3), 1)[0]).toBeNull();
  });
});

function ctx(over: Partial<ElevSnowContext> = {}): ElevSnowContext {
  return {
    blendSnow: [1, 1, 1, 1],
    blendRaw: [0.5, 0.5, 0.5, 0.5],
    modelSnow: { gfs: [2, 2, 2, 2], ecmwf: [0, 0, 0, 0] },
    memberSnow: [],
    shortRangeEnd: 48,
    ...over,
  };
}

describe('snowAmount', () => {
  it('falls back to the model spread without ensembles', () => {
    const a = snowAmount([0, 1, 2, 3], ctx());
    expect(a.blend).toBe(4);
    expect(a.models).toEqual({ gfs: 8, ecmwf: 0 });
    expect(a.range).toEqual({ lo: 0, hi: 8 });
    expect(a.rangeSource).toBe('models');
    expect(a.rawBlend).toBe(2);
  });

  it('uses ensemble P25–P75 and widens it to contain the blend', () => {
    const members = Array.from({ length: 20 }, (_, i) => [i / 10, 0, 0, 0] as Hourly);
    const a = snowAmount([0, 1, 2, 3], ctx({ memberSnow: members }));
    expect(a.rangeSource).toBe('ensemble');
    expect(a.p10).not.toBeNull();
    expect(a.range!.lo).toBeLessThanOrEqual(a.blend!);
    expect(a.range!.hi).toBeGreaterThanOrEqual(a.blend!);
    expect(a.range!.hi).toBe(4); // P75 of members is ~1.4, widened to the 4" blend
  });

  it('ignores HRRR/NBM in the model range outside the short range', () => {
    const a = snowAmount([0, 1, 2, 3], ctx({ modelSnow: { gfs: [1, 1, 1, 1], hrrr: [9, 9, 9, 9] }, shortRangeEnd: 1 }));
    expect(a.models.hrrr).toBe(36);
    expect(a.range).toBeNull(); // only one long-range model left
  });
});

describe('confidence', () => {
  const amount = (lo: number, hi: number, p90 = hi, source: SnowAmount['rangeSource'] = 'ensemble'): SnowAmount => ({
    blend: (lo + hi) / 2,
    range: { lo, hi },
    rangeSource: source,
    p10: lo,
    p90,
    models: {},
    rawBlend: null,
  });

  it('is high when nothing is coming', () => expect(confidenceOf(amount(0, 0.4, 0.8))).toBe('high'));
  it('is high when the spread is tight', () => expect(confidenceOf(amount(10, 13))).toBe('high'));
  it('is medium for moderate spread', () => expect(confidenceOf(amount(6, 10))).toBe('medium'));
  it('is low for wide spread', () => expect(confidenceOf(amount(0, 12))).toBe('low'));
  it('trusts two models less than an ensemble', () => expect(confidenceOf(amount(10, 13, 13, 'models'))).toBe('medium'));
  it('is low with a single model', () =>
    expect(confidenceOf({ ...amount(0, 0), range: null, rangeSource: null, blend: 3 })).toBe('low'));
});

describe('stale carry-forward', () => {
  const ok: Sourced<number> = { status: { ok: true, stale: false, fetchedAt: '2026-10-23T12:00:00Z' }, data: 1 };
  const failed: Sourced<number> = { status: { ok: false, stale: false, fetchedAt: null, error: 'HTTP 503' }, data: null };

  it('keeps fresh data', () => expect(carryForward(ok, { ...ok, data: 0 })).toBe(ok));

  it('carries the previous value forward and marks it stale', () => {
    const out = carryForward(failed, ok);
    expect(out.data).toBe(1);
    expect(out.status).toEqual({ ok: false, stale: true, fetchedAt: '2026-10-23T12:00:00Z', error: 'HTTP 503' });
  });

  it('reports the failure when there is nothing to fall back on', () => expect(carryForward(failed, null)).toBe(failed));
});
