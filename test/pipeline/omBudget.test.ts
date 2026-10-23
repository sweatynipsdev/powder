import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendOmLog, budgetCheck, OM_LOG_HEADER, type OmLogRow, OmPacer, omWeight, parseOmLog } from '../../pipeline/sources/omBudget';
import { DET_WEIGHT, ENS_WEIGHT } from '../../pipeline/sources/openMeteo';

describe('Open-Meteo request weight', () => {
  it('counts our two requests the way Open-Meteo does', () => {
    // 8 models × 9 variables at 2 elevations for 16 days; 82 members × 2 variables.
    expect(omWeight({ locations: 2, days: 16, variables: 72 })).toBeCloseTo(16.46, 2);
    expect(omWeight({ locations: 2, days: 16, variables: 164 })).toBeCloseTo(37.49, 2);
    expect(DET_WEIGHT).toBeCloseTo(16.46, 2);
    expect(ENS_WEIGHT).toBeCloseTo(37.49, 2);
  });

  it('never counts a request as less than one call per location', () => {
    expect(omWeight({ locations: 1, days: 7, variables: 3 })).toBe(1);
  });
});

describe('pacing', () => {
  function fakeClock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms), at: () => t };
  }

  it('holds a request until the last minute has room for it', async () => {
    const clock = fakeClock();
    const pacer = new OmPacer({ perMinute: 450, now: clock.now, sleep: clock.sleep });
    await pacer.take(200);
    await pacer.take(200);
    expect(clock.at()).toBe(0);
    await pacer.take(200);
    expect(clock.at()).toBe(60_000);
    expect(pacer.total).toBe(600);
  });

  it('lets one oversized request through rather than waiting forever', async () => {
    const clock = fakeClock();
    const pacer = new OmPacer({ perMinute: 450, now: clock.now, sleep: clock.sleep });
    await pacer.take(500);
    expect(clock.at()).toBe(0);
  });

  it('runs only maxInFlight requests at once, the rest in arrival order', async () => {
    const pacer = new OmPacer({ perMinute: 1_000, maxInFlight: 2 });
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const started: number[] = [];
    const finish: (() => void)[] = [];
    let running = 0;
    let peak = 0;
    const request = (i: number) => () =>
      new Promise<number>((resolve) => {
        started.push(i);
        peak = Math.max(peak, ++running);
        finish[i] = () => {
          running--;
          resolve(i);
        };
      });
    const runs = [0, 1, 2, 3, 4].map((i) => pacer.run(1, request(i)));
    await flush();
    expect(started).toEqual([0, 1]);
    finish[1]();
    await flush();
    expect(started).toEqual([0, 1, 2]);
    finish[0]();
    finish[2]();
    await flush();
    expect(started).toEqual([0, 1, 2, 3, 4]);
    finish[3]();
    finish[4]();
    expect(await Promise.all(runs)).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(pacer.total).toBe(5);
  });

  it('frees the slot when a request fails', async () => {
    const pacer = new OmPacer({ perMinute: 1_000, maxInFlight: 1 });
    await expect(pacer.run(1, () => Promise.reject(new Error('reset')))).rejects.toThrow('reset');
    await expect(pacer.run(1, async () => 'ok')).resolves.toBe('ok');
  });

  it('only counts when switched off (fixture replay)', async () => {
    const clock = fakeClock();
    const pacer = new OmPacer({ perMinute: 10, now: clock.now, sleep: clock.sleep, enabled: () => false });
    for (let i = 0; i < 5; i++) await pacer.take(10);
    expect(clock.at()).toBe(0);
    expect(pacer.total).toBe(50);
  });
});

describe('daily budget across runs', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  const row = (min: number, weight: number): OmLogRow => ({ at: ago(min), trigger: 'schedule', weight });

  it('reads the log, skipping the header and anything malformed', () => {
    expect(parseOmLog('')).toEqual([]);
    expect(parseOmLog(`${OM_LOG_HEADER}\n`)).toEqual([]);
    const rows = parseOmLog(`${OM_LOG_HEADER}\n2026-10-24T00:20:31.000Z,schedule,2311\nnot,a,row\n\n2026-10-24T03:00:00.000Z,push\n`);
    expect(rows).toEqual([{ at: new Date('2026-10-24T00:20:31.000Z'), trigger: 'schedule', weight: 2311 }]);
  });

  it('counts only the last 24 hours and the last hour', () => {
    const c = budgetCheck([row(24 * 60, 5000), row(23 * 60, 1000), row(59, 200)], now, 41);
    expect(c.day).toBe(1200);
    expect(c.hour).toBe(200);
    expect(c.estimate).toBe(2546);
  });

  it('defers when the day or the hour would go over', () => {
    expect(budgetCheck([row(600, 6900)], now, 41).defer).toBe(false);
    expect(budgetCheck([row(600, 7000)], now, 41).defer).toBe(true);
    expect(budgetCheck([row(30, 2400)], now, 41).defer).toBe(true);
    expect(budgetCheck([row(90, 2400)], now, 41).defer).toBe(false);
  });

  it('never defers on an empty log (the first run after this ships)', () => {
    expect(budgetCheck([], now, 41)).toEqual({ day: 0, hour: 0, estimate: 2546, defer: false });
  });

  it('writes the header once, then one line per run', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'om-')), 'openmeteo.csv');
    appendOmLog(path, ago(60), 'schedule', 2310.6);
    appendOmLog(path, now, 'push', 2290);
    expect(readFileSync(path, 'utf8')).toBe(`${OM_LOG_HEADER}\n2026-10-24T11:00:00.000Z,schedule,2311\n2026-10-24T12:00:00.000Z,push,2290\n`);
  });
});
