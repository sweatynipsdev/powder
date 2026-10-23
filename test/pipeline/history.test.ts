import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendHistory,
  computeCalibration,
  EVENT_IN,
  type ForecastSnapshot,
  loadCalibration,
  loadObservations,
  loadSnapshots,
  MIN_EVENTS,
  type Observation,
  observedSnow,
  writeCalibration,
} from '../../pipeline/history';
import { addDays } from '../../pipeline/clock';
import { refreshCaption, UPDATE_TIMES_UTC } from '../../shared/schedule';
import { resortOpenStatus } from '../../shared/status';
import type { ReportData } from '../../shared/types';

/** A morning run on `date` forecasting `snow` for each model for the day before it observes. */
const snap = (date: string, models: Record<string, number>, resort = 'mammoth'): ForecastSnapshot => ({
  at: `${date}T13:20:00Z`,
  local: `${date}T06:20`,
  resort,
  days: [0, 1].map((k) => ({ date: addDays(date, k), blend: Object.values(models)[0], models })),
});

const obs = (date: string, reportH24: number | null, resort = 'mammoth', local = `${date}T06:20`): Observation => ({
  at: `${date}T13:20:00Z`,
  local,
  resort,
  reportH24,
  stationNew24: null,
  depthChange24: null,
});

/** `n` storms where GFS forecast `fcst` one morning ahead and the resort reported `seen`. */
function storms(n: number, fcst: Record<string, number>, seen: number) {
  const snaps: ForecastSnapshot[] = [];
  const observed: Observation[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays('2026-12-01', i * 5);
    snaps.push(snap(day, fcst));
    observed.push(obs(addDays(day, 1), seen));
  }
  return { snaps, observed };
}

describe('local model calibration', () => {
  it('prefers the resort report, then a snow observer, then depth gain', () => {
    expect(observedSnow({ ...obs('2026-12-02', 8), stationNew24: 5 })).toBe(8);
    expect(observedSnow({ ...obs('2026-12-02', null), stationNew24: 5, depthChange24: 9 })).toBe(5);
    expect(observedSnow({ ...obs('2026-12-02', null), depthChange24: -3 })).toBe(0);
    expect(observedSnow(obs('2026-12-02', null))).toBeNull();
  });

  it('learns that a model runs low at one mountain', () => {
    const { snaps, observed } = storms(MIN_EVENTS, { gfs: 10, ecmwf: 15 }, 15);
    const cal = computeCalibration(snaps, observed);
    expect(cal.mammoth?.gfs).toEqual({ factor: 1.5, events: MIN_EVENTS });
    expect(cal.mammoth?.ecmwf?.factor).toBe(1);
  });

  it('waits for enough snow events before correcting anything', () => {
    const { snaps, observed } = storms(MIN_EVENTS - 1, { gfs: 10 }, 15);
    expect(computeCalibration(snaps, observed)).toEqual({});
  });

  it('ignores dry days and afternoon runs', () => {
    const dry = storms(MIN_EVENTS * 2, { gfs: EVENT_IN / 4 }, 0);
    expect(computeCalibration(dry.snaps, dry.observed)).toEqual({});
    const wet = storms(MIN_EVENTS, { gfs: 10 }, 15);
    const afternoon = wet.observed.map((o) => ({ ...o, local: `${o.local.slice(0, 10)}T16:20` }));
    expect(computeCalibration(wet.snaps, afternoon)).toEqual({});
  });

  it('clamps a wild correction', () => {
    const { snaps, observed } = storms(MIN_EVENTS, { gfs: 5 }, 40);
    expect(computeCalibration(snaps, observed).mammoth?.gfs?.factor).toBe(1.6);
  });

  it('round-trips history and calibration files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powder-history-'));
    appendHistory(dir, [], new Date('2026-12-01T13:20:00Z'));
    expect(loadSnapshots(dir)).toEqual([]);
    expect(loadObservations(dir)).toEqual([]);
    const path = join(dir, 'calibration.json');
    writeCalibration(path, { mammoth: { gfs: { factor: 1.2, events: 7 } } }, new Date());
    expect(loadCalibration(path)).toEqual({ mammoth: { gfs: { factor: 1.2, events: 7 } } });
    expect(loadCalibration(join(dir, 'missing.json'))).toEqual({});
  });
});

describe('resort open status', () => {
  const now = new Date('2026-10-23T18:00:00Z');
  const report = (over: Partial<ReportData>): ReportData => ({
    name: 'x', updatedAt: '2026-10-23T14:00:00Z', fresh: true, operatingStatus: null, conditions: null, areas: [],
    h24: null, h48: null, d7: null, baseDepthIn: null, seasonTotalIn: null,
    liftsOpen: 0, liftsTotal: 25, trailsOpen: null, trailsTotal: null, ...over,
  });

  const tz = 'America/Los_Angeles';

  it('shows the opening date before opening day', () => {
    expect(resortOpenStatus(report({}), now, { openingDate: '2026-11-13', tz })).toEqual({ state: 'not-open', text: 'Opening Nov 13' });
    expect(resortOpenStatus(null, now, { openingDate: '2026-11-13', tz }).text).toBe('Opening Nov 13');
  });

  it("stops counting down on the morning of opening day, in the resort's time zone", () => {
    const openingMorning = new Date('2026-11-13T13:20:00Z'); // 5:20am PST
    const eveBefore = new Date('2026-11-13T07:00:00Z'); // 11pm PST on Nov 12
    expect(resortOpenStatus(null, openingMorning, { openingDate: '2026-11-13', tz }).text).not.toBe('Opening Nov 13');
    expect(resortOpenStatus(null, eveBefore, { openingDate: '2026-11-13', tz }).text).toBe('Opening Nov 13');
    // The same moment is already opening day in Utah (12am MST).
    expect(resortOpenStatus(null, eveBefore, { openingDate: '2026-11-13', tz: 'America/Denver' }).text).not.toBe('Opening Nov 13');
  });

  it('says open when lifts turn early, and ignores a past opening date', () => {
    expect(resortOpenStatus(report({ liftsOpen: 3 }), now, { openingDate: '2026-11-13', tz })).toEqual({ state: 'open', text: 'Open · 3/25 lifts' });
    expect(resortOpenStatus(report({}), now, { openingDate: '2026-10-01', tz })).toEqual({ state: 'not-open', text: 'Not open yet' });
  });

  it('points to the resort when there is no snow-report feed, and says so when a feed failed', () => {
    expect(resortOpenStatus(null, now, { tz })).toEqual({ state: 'unknown', text: 'Lift status on resort site' });
    expect(resortOpenStatus(null, now, { tz, hasFeed: true })).toEqual({ state: 'unknown', text: 'Lift report unavailable' });
  });

  it('calls an off-season report closed', () => {
    expect(resortOpenStatus(report({ fresh: false, updatedAt: '2026-06-08T17:00:00Z' }), now, { tz }).text).toBe('Closed · last report Jun 8');
  });
});

describe('update times', () => {
  it("says when data refreshes in the resort's own time, through daylight saving", () => {
    expect(refreshCaption('America/Denver', new Date('2026-12-01T12:00:00Z'))).toBe('about 6:20am and 5:20pm MST');
    expect(refreshCaption('America/Denver', new Date('2026-07-01T12:00:00Z'))).toBe('about 7:20am and 6:20pm MDT');
    expect(refreshCaption('America/Los_Angeles', new Date('2026-12-01T12:00:00Z'))).toBe('about 5:20am and 4:20pm PST');
  });

  it('matches the cron lines in the update workflow', () => {
    const yml = readFileSync(new URL('../../.github/workflows/update.yml', import.meta.url), 'utf8');
    for (const { h, m } of UPDATE_TIMES_UTC) expect(yml).toContain(`cron: '${m} ${h} * * *'`);
  });
});
