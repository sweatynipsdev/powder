// End-to-end: the whole pipeline replayed from recorded fixtures, no network.

import { beforeAll, describe, expect, it } from 'vitest';
import { setNow } from '../../pipeline/clock';
import { loadConfig, parseConfig } from '../../pipeline/config';
import { configureHttp } from '../../pipeline/http';
import { EMPTY_PREVIOUS } from '../../pipeline/previous';
import { runPipeline, type PipelineResult } from '../../pipeline/run';
import type { SnowAmount } from '../../shared/types';
import { FIXTURE_DIR, recordedAt } from '../helpers';

const config = loadConfig();

function allAmounts(r: PipelineResult['resorts'][number]): SnowAmount[] {
  const f = r.forecast.data!;
  return [
    ...f.periods.flatMap((p) => [p.snow.summit, p.snow.base]),
    ...f.days.flatMap((d) => [d.snow.summit, d.snow.base]),
    ...Object.values(f.windows).flatMap((w) => [w.summit, w.base]),
    ...Object.values(f.buckets).flatMap((b) => [b.summit, b.base]),
  ];
}

describe('pipeline replay', () => {
  let result: PipelineResult;

  beforeAll(async () => {
    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: null, retryDelaysMs: [] });
    setNow(recordedAt);
    result = await runPipeline(config, EMPTY_PREVIOUS, recordedAt);
  });

  it('gets every configured source for every resort', () => {
    for (const r of result.resorts) {
      for (const key of ['forecast', 'cpc', 'snowpack', 'nws', 'alerts', 'afd', 'avalanche', 'roads', 'report'] as const) {
        const s = r[key];
        if (s === null) continue; // not configured (Big Bear has no avalanche center)
        expect(s.status.ok, `${r.id}/${key}: ${s.status.error}`).toBe(true);
      }
    }
    expect(result.resorts.find((r) => r.id === 'bigbear')!.avalanche).toBeNull();
  });

  it('builds 16 days of day/night periods', () => {
    for (const r of result.resorts) {
      expect(r.forecast.data!.periods).toHaveLength(32);
      expect(r.forecast.data!.days).toHaveLength(16);
    }
  });

  it('never shows a blend outside its range', () => {
    for (const r of result.resorts)
      for (const a of allAmounts(r)) {
        if (!a.range || a.blend === null) continue;
        expect(a.range.lo).toBeLessThanOrEqual(a.blend);
        expect(a.range.hi).toBeGreaterThanOrEqual(a.blend);
      }
  });

  it('adds up: the 1–5 day bucket equals the sum of those days', () => {
    for (const r of result.resorts) {
      const f = r.forecast.data!;
      const sum = f.days.slice(0, 5).reduce((s, d) => s + (d.snow.summit.blend ?? 0), 0);
      expect(f.buckets.d1_5.summit.blend!).toBeCloseTo(sum, 0);
    }
  });

  it('builds running totals that never shrink and drop models that stop early', () => {
    for (const r of result.resorts) {
      const c = r.forecast.data!.cumulative;
      expect(c).toHaveLength(16);
      const blends = c.map((d) => d.summit.blend).filter((v): v is number => v !== null);
      for (let i = 1; i < blends.length; i++) expect(blends[i]).toBeGreaterThanOrEqual(blends[i - 1] - 0.1);
      const sum5 = r.forecast.data!.days.slice(0, 5).reduce((s, d) => s + (d.snow.summit.blend ?? 0), 0);
      expect(c[4].summit.blend!).toBeCloseTo(sum5, 0);
      // ICON runs about 7 days, so it has no 10-day running total.
      expect(c[2].summit.models.icon).toBeDefined();
      expect(c[9].summit.models.icon).toBeUndefined();
    }
  });

  it('keeps the summit at least as snowy as the base', () => {
    for (const r of result.resorts) {
      const w = r.forecast.data!.windows.next7d;
      expect(w.summit.blend!).toBeGreaterThanOrEqual(w.base.blend!);
    }
  });

  it('writes a home-screen summary for each resort', () => {
    expect(result.index.resorts.map((r) => r.id)).toEqual(config.resorts.map((r) => r.id));
    for (const s of result.index.resorts) {
      expect(s.strip).toHaveLength(20);
      expect(s.windows).not.toBeNull();
      expect(s.staleSources).toEqual([]);
    }
    expect(result.index.enso?.status).toBeTruthy();
  });
});

describe('a source outage', () => {
  it('marks only that source stale, carries the last value forward and drops expired alerts', async () => {
    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: null, retryDelaysMs: [] });
    setNow(recordedAt);
    const first = await runPipeline(config, EMPTY_PREVIOUS, recordedAt);

    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: /mtnpowder\.com|api\.weather\.gov\/alerts/, retryDelaysMs: [] });
    const previous = { index: first.index, resorts: new Map(first.resorts.map((r) => [r.id, r])) };
    const later = new Date(recordedAt.getTime() + 12 * 3600_000);
    const second = await runPipeline(config, previous, later);

    for (const r of second.resorts) {
      expect(r.report!.status).toMatchObject({ ok: false, stale: true, fetchedAt: recordedAt.toISOString() });
      expect(r.report!.data).toEqual(first.resorts.find((x) => x.id === r.id)!.report!.data);
      expect(r.alerts.status.ok).toBe(false);
      expect(r.alerts.data).toBeNull();
      expect(r.forecast.status.ok).toBe(true);
    }
    expect(second.index.resorts[0].staleSources.sort()).toEqual(['alerts', 'report']);
  });

  it('still produces output when nothing is reachable and there is no history', async () => {
    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: /./, retryDelaysMs: [] });
    const out = await runPipeline(config, EMPTY_PREVIOUS, recordedAt);
    expect(out.resorts).toHaveLength(config.resorts.length);
    expect(out.resorts.every((r) => r.forecast.data === null && !r.forecast.status.ok)).toBe(true);
  });
});

describe('resorts.json validation', () => {
  const base = JSON.parse(JSON.stringify({ resorts: [config.resorts[0]] }));

  it('accepts the shipped config', () => expect(() => parseConfig(base)).not.toThrow());

  it('rejects a summit below the base', () => {
    const bad = structuredClone(base);
    bad.resorts[0].summitFt = 100;
    expect(() => parseConfig(bad)).toThrow(/summitFt/);
  });

  it('rejects duplicate ids', () => {
    expect(() => parseConfig({ resorts: [base.resorts[0], base.resorts[0]] })).toThrow(/unique/);
  });

  it('only needs the core fields for a new resort', () => {
    const minimal = { id: 'kirkwood', name: 'Kirkwood', shortName: 'Kirkwood', region: 'Tahoe', lat: 38.68, lon: -120.07, baseFt: 7800, summitFt: 9800, tz: 'America/Los_Angeles', nws: { afdOffice: 'REV' } };
    const parsed = parseConfig({ resorts: [minimal] });
    expect(parsed.resorts[0].roads).toEqual([]);
    expect(parsed.resorts[0].links.cams).toEqual([]);
  });
});
