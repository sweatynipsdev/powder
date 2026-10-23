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

  it('only counts when switched off (fixture replay)', async () => {
    const clock = fakeClock();
    const pacer = new OmPacer({ perMinute: 10, now: clock.now, sleep: clock.sleep, enabled: () => false });
    for (let i = 0; i < 5; i++) await pacer.take(10);
    expect(clock.at()).toBe(0);
    expect(pacer.total).toBe(50);
  });
});
