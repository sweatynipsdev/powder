// End-to-end: the whole pipeline replayed from recorded fixtures, no network.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setNow } from '../../pipeline/clock';
import { loadConfig, parseConfig } from '../../pipeline/config';
import { configureHttp } from '../../pipeline/http';
import { EMPTY_PREVIOUS } from '../../pipeline/previous';
import { buildResort, runPipeline, type PipelineResult } from '../../pipeline/run';
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
      for (const key of ['forecast', 'cpc', 'snowpack', 'nws', 'alerts', 'afd', 'avalanche', 'roads', 'report', 'expert'] as const) {
        if (!r[key]) continue; // not configured (only Mammoth has a local expert)
        const s = r[key];
        if (s === null) continue; // not configured (Big Bear has no avalanche center)
        expect(s.status.ok, `${r.id}/${key}: ${s.status.error}`).toBe(true);
      }
    }
    expect(result.resorts.find((r) => r.id === 'bigbear')!.avalanche).toBeNull();
  });

  it("gives the home screen WSDOT's own wording for the worst road, and Caltrans none", () => {
    const summary = (id: string) => result.index.resorts.find((r) => r.id === id)!;
    expect(summary('crystal').roadsText).toBe('No restrictions');
    expect(summary('palisades').roadsText).toBeNull();
  });

  it('credits Caltrans for its roads and leaves its wording to the app', () => {
    const roads = result.resorts.find((r) => r.id === 'palisades')!.roads!.data!;
    expect(roads.agencies).toEqual(['Caltrans']);
    expect(roads.segments.every((s) => s.restriction === null)).toBe(true);
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

  it("adds the NWS forecasters' grid as its own model", () => {
    for (const r of result.resorts) {
      const f = r.forecast.data!;
      expect(f.models.find((m) => m.id === 'nws')?.label).toBe('NWS forecasters');
      expect(f.nwsGridFt!.summit).toBeGreaterThan(f.nwsGridFt!.base! - 1);
      expect(f.days[0].snow.summit.models.nws).toBeDefined();
    }
    expect(result.resorts.find((r) => r.id === 'mammoth')!.expert!.status.ok).toBe(true);
  });

  it("scales a model by the mountain's learned bias", async () => {
    const calibrated = await runPipeline(config, EMPTY_PREVIOUS, recordedAt, { palisades: { gfs: { factor: 1.5, events: 8 } } });
    const total = (rs: PipelineResult['resorts'], id: string) => rs.find((r) => r.id === id)!.forecast.data!.cumulative[6].summit.models;
    const raw = total(result.resorts, 'palisades').gfs!;
    expect(raw).toBeGreaterThan(0);
    expect(total(calibrated.resorts, 'palisades').gfs!).toBeCloseTo(raw * 1.5, 0);
    expect(total(calibrated.resorts, 'palisades').ecmwf).toBe(total(result.resorts, 'palisades').ecmwf);
    expect(total(calibrated.resorts, 'alpine').gfs).toBe(total(result.resorts, 'alpine').gfs);
    expect(calibrated.resorts.find((r) => r.id === 'palisades')!.forecast.data!.calibration).toEqual({ gfs: { factor: 1.5, events: 8 } });
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
      expect(s.days).toHaveLength(10);
      expect(s.status.text).toBeTruthy();
      expect(s.windows).not.toBeNull();
      expect(s.staleSources).toEqual([]);
    }
    expect(result.index.enso?.status).toBeTruthy();
  });

  it('marks which resorts a new phone starts with', () => {
    const defaults = result.index.resorts.filter((s) => s.defaultFavorite).map((s) => s.id);
    expect(defaults).toEqual(['palisades', 'alpine', 'mammoth', 'bigbear']);
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
      if (r.report) {
        expect(r.report.status).toMatchObject({ ok: false, stale: true, fetchedAt: recordedAt.toISOString() });
        expect(r.report.data).toEqual(first.resorts.find((x) => x.id === r.id)!.report!.data);
      }
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

  it('leaves a resort off the default favorites unless it says otherwise', () => {
    const plain = structuredClone(base);
    delete plain.resorts[0].defaultFavorite;
    expect(parseConfig(plain).resorts[0].defaultFavorite).toBe(false);
  });

  it('reads a road with no provider as Caltrans, and a WSDOT pass by name', () => {
    const raw = JSON.parse(readFileSync(new URL('../../resorts.json', import.meta.url), 'utf8')).resorts[0];
    expect(raw.roads[0].provider).toBeUndefined();
    const stevens = { provider: 'wsdot', label: 'US-2 Stevens Pass', route: 'US-2', pass: 'Stevens Pass US 2' };
    const roads = parseConfig({ resorts: [{ ...raw, roads: [...raw.roads, stevens] }] }).resorts[0].roads;
    expect(roads[0].provider).toBe('caltrans');
    expect(roads.at(-1)).toEqual(stevens);
  });

  it('rejects a WSDOT road without a pass name', () => {
    const bad = structuredClone(base);
    bad.resorts[0].roads = [{ provider: 'wsdot', label: 'US-2', route: 'US-2' }];
    expect(() => parseConfig(bad)).toThrow();
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

  const whistler = {
    id: 'whistler', name: 'Whistler Blackcomb', shortName: 'Whistler', region: 'British Columbia', lat: 50.115, lon: -122.95,
    baseFt: 2214, summitFt: 7494, tz: 'America/Vancouver', country: 'CA', eccc: { bbox: [50.05, -123.0, 50.15, -122.9] }, avalanche: { provider: 'avcan' },
  };

  it('takes a Canadian resort with ECCC alerts and no NWS block, and only then', () => {
    expect(parseConfig({ resorts: [whistler] }).resorts[0]).toMatchObject({ country: 'CA', avalanche: { provider: 'avcan' } });
    expect(() => parseConfig({ resorts: [{ ...whistler, nws: {} }] })).toThrow(/nws/);
    expect(() => parseConfig({ resorts: [{ ...whistler, eccc: undefined }] })).toThrow(/eccc/);
    const { nws: _, ...usWithoutNws } = base.resorts[0];
    expect(() => parseConfig({ resorts: [usWithoutNws] })).toThrow(/nws/);
  });

  it('builds a Canadian resort with no NWS forecast, discussion or CPC outlooks', async () => {
    const [cfg] = parseConfig({ resorts: [whistler] }).resorts;
    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: /./, retryDelaysMs: [] });
    const r = await buildResort(cfg, recordedAt, undefined);
    expect(r.nws).toBeNull();
    expect(r.afd).toBeNull();
    expect(r.nwsArea).toBe('British Columbia');
    // CPC is ENSO only outside the US; here every request fails, so it's just unavailable.
    expect(r.cpc.status.ok).toBe(false);
  });

  it('links to an avalanche center that has no feed we may read', async () => {
    const vail = { id: 'vail', name: 'Vail', shortName: 'Vail', region: 'Colorado', lat: 39.64, lon: -106.37, baseFt: 8120, summitFt: 11570, tz: 'America/Denver', nws: {}, links: { avalanche: 'https://avalanche.state.co.us/' } };
    const [cfg] = parseConfig({ resorts: [vail] }).resorts;
    configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: /./, retryDelaysMs: [] });
    const r = await buildResort(cfg, recordedAt, undefined);
    expect(r.links.avalanche).toBe('https://avalanche.state.co.us/');
    expect(r.avalanche).toBeNull();
  });
});
