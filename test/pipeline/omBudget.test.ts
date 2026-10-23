import { describe, expect, it } from 'vitest';
import { OmPacer, omWeight } from '../../pipeline/sources/omBudget';
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
