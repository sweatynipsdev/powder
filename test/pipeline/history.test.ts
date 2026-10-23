import { mkdtempSync } from 'node:fs';
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

  it('shows the opening date before opening day', () => {
    expect(resortOpenStatus(report({}), now, '2026-11-13')).toEqual({ state: 'not-open', text: 'Opening Nov 13' });
    expect(resortOpenStatus(null, now, '2026-11-13').text).toBe('Opening Nov 13');
  });

  it('says open when lifts turn early, and ignores a past opening date', () => {
    expect(resortOpenStatus(report({ liftsOpen: 3 }), now, '2026-11-13')).toEqual({ state: 'open', text: 'Open · 3/25 lifts' });
    expect(resortOpenStatus(report({}), now, '2026-10-01')).toEqual({ state: 'not-open', text: 'Not open yet' });
  });

  it('points to the resort when there is no snow-report feed', () => {
    expect(resortOpenStatus(null, now)).toEqual({ state: 'unknown', text: 'Lift status on resort site' });
  });

  it('calls an off-season report closed', () => {
    expect(resortOpenStatus(report({ fresh: false, updatedAt: '2026-06-08T17:00:00Z' }), now).text).toBe('Closed · last report Jun 8');
  });
});
