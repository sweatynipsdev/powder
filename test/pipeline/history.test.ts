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
  reportedSnowByDay,
  writeCalibration,
} from '../../pipeline/history';
import { addDays } from '../../pipeline/clock';
import { lastSlot, refreshCaption, slotAlreadyUpdated, slotOf, UPDATE_TIMES_UTC } from '../../shared/schedule';
import { prevDaysSnow, resortOpenStatus, stationNewSnow, stationTimeIso } from '../../shared/status';
import type { ReportData, SnowpackData } from '../../shared/types';

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

describe('the days before today', () => {
  const tz = 'America/Los_Angeles';
  const row = (at: string, local: string, reportH24: number | null, reportAt?: string): Observation => ({
    at, local, resort: 'mammoth', reportH24, ...(reportAt ? { reportAt } : {}), stationNew24: null, depthChange24: null,
  });
  // Mammoth as logged 2026-10-31 to 11-04 (before reportAt existed), then a run with it.
  const mammoth = [
    row('2026-11-01T06:17:30Z', '2026-10-31T23:17', null),
    row('2026-11-01T16:02:48Z', '2026-11-01T08:02', 15),
    row('2026-11-02T06:19:21Z', '2026-11-01T22:19', 15),
    row('2026-11-02T19:14:18Z', '2026-11-02T11:14', 0),
    row('2026-11-03T06:55:46Z', '2026-11-02T22:55', 0),
    row('2026-11-03T10:00:01Z', '2026-11-03T02:00', 0),
    row('2026-11-04T00:28:06Z', '2026-11-03T16:28', 0),
    row('2026-11-04T17:16:19Z', '2026-11-04T09:16', 0, '2026-11-04T08:09:28-08:00'),
  ];
  /** A station's days as [date, last depth of the day, depth at ~7am]. */
  const days = (series: [string, number | null, (number | null)?][]): SnowpackData => ({
    station: { id: 'x', name: 'x', network: 'CDEC', elevFt: 9400, url: 'https://example.com' },
    observedAt: null, depthIn: null, sweIn: null, tempF: null, newSnow: null, note: null,
    change: { h24: { depthIn: null, sweIn: null }, h48: { depthIn: null, sweIn: null }, d7: { depthIn: null, sweIn: null } },
    series: series.map(([date, depthIn, morningDepthIn]) => ({ date, depthIn, sweIn: null, ...(morningDepthIn !== undefined ? { morningDepthIn } : {}) })),
  });
  // Kirkwood's Oct 31 storm: 9" by the morning of Nov 1.
  const kirkwood: [string, number, number][] = [
    ['2026-10-29', 0, 0], ['2026-10-30', 1, 0], ['2026-10-31', 10, 1], ['2026-11-01', 11, 10], ['2026-11-02', 9, 11], ['2026-11-03', 10, 9], ['2026-11-04', 9, 10],
  ];

  it("dates Mammoth's 15\" by the morning it reported it, and leaves today's report to Last 24 Hours", () => {
    expect(reportedSnowByDay(mammoth, tz, '2026-11-04')).toEqual([
      { date: '2026-11-01', inches: 15 },
      { date: '2026-11-02', inches: 0 },
      { date: '2026-11-03', inches: 0 },
    ]);
  });

  it("dates a report by its own time, and an old 2am row by the previous morning's report", () => {
    // A 6:55am run still showing yesterday's 8am report.
    expect(reportedSnowByDay([row('2026-11-03T14:55:00Z', '2026-11-03T06:55', 5, '2026-11-02T08:00:00-08:00')], tz, '2026-11-04')).toEqual([{ date: '2026-11-02', inches: 5 }]);
    expect(reportedSnowByDay([row('2026-11-03T10:00:00Z', '2026-11-03T02:00', 5)], tz, '2026-11-04')).toEqual([{ date: '2026-11-02', inches: 5 }]);
  });

  it('keeps the latest run for a day, and only the week before today', () => {
    // The resort revised its Nov 1 report in the afternoon; a run after that sees 18".
    const revised = row('2026-11-02T07:00:00Z', '2026-11-01T23:00', 18, '2026-11-01T15:30:00-07:00');
    expect(reportedSnowByDay([...mammoth, revised], tz, '2026-11-04')[0]).toEqual({ date: '2026-11-01', inches: 18 });
    expect(reportedSnowByDay(mammoth, tz, '2026-11-09').map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(reportedSnowByDay(mammoth, tz, '2026-11-02').map((d) => d.date)).toEqual(['2026-11-01']);
  });

  it("fills Mammoth's row from its reports when its station has no depth", () => {
    const broken = days([['2026-10-30', null, null], ['2026-10-31', null, null], ['2026-11-01', 17, null], ['2026-11-02', null, null], ['2026-11-03', null, null], ['2026-11-04', null, null]]);
    expect(prevDaysSnow(reportedSnowByDay(mammoth, tz, '2026-11-04'), broken, '2026-11-04')).toEqual([
      { date: '2026-10-30', inches: null, source: null },
      { date: '2026-10-31', inches: null, source: null },
      { date: '2026-11-01', inches: 15, source: 'reported' },
      { date: '2026-11-02', inches: 0, source: 'reported' },
      { date: '2026-11-03', inches: 0, source: 'reported' },
    ]);
  });

  it("gives a station day the gain in its morning depth, so a storm lands on the morning it was measured, like a report", () => {
    const filled = prevDaysSnow([{ date: '2026-11-02', inches: 3 }], days(kirkwood), '2026-11-04');
    expect(filled.map((d) => [d.date.slice(5), d.inches, d.source])).toEqual([
      ['10-30', 0, 'estimated'], ['10-31', 1, 'estimated'], ['11-01', 9, 'estimated'], ['11-02', 3, 'reported'], ['11-03', 0, 'estimated'],
    ]);
  });

  it("uses the day before's calendar gain without morning depths, and an observer's own mornings as they are", () => {
    const old = days(kirkwood.map(([date, depth]) => [date, depth]));
    expect(prevDaysSnow(undefined, old, '2026-11-04').map((d) => d.inches)).toEqual([null, 1, 9, 1, 0]);
    const observer: SnowpackData = { ...days([]), station: { ...days([]).station, network: 'CoCoRaHS' } };
    observer.series = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'].map((date, i) => ({ date, depthIn: null, sweIn: null, newIn: [0, 0, 6, 2, 0][i] }));
    expect(prevDaysSnow(undefined, observer, '2026-11-04').map((d) => d.inches)).toEqual([0, 0, 6, 2, 0]);
    expect(prevDaysSnow(undefined, null, '2026-11-04').every((d) => d.inches === null && d.source === null)).toBe(true);
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

describe('station new snow', () => {
  const station = (over: Partial<SnowpackData>): SnowpackData => ({
    station: { id: 'x', name: 'x', network: 'SNOTEL', elevFt: 8000, url: 'https://example.com' },
    observedAt: null, depthIn: 20, sweIn: 5, tempF: null, newSnow: null, series: [], note: null,
    change: { h24: { depthIn: -1, sweIn: 0 }, h48: { depthIn: null, sweIn: null }, d7: { depthIn: 4, sweIn: 0.4 } },
    ...over,
  });

  it('counts settling as no new snow, not negative snow', () => {
    expect(stationNewSnow(station({}), 'h24')).toBe(0);
    expect(stationNewSnow(station({}), 'd7')).toBe(4);
  });

  it("prefers an observer's measurement, then depth, then water", () => {
    expect(stationNewSnow(station({ newSnow: { h24: 6, h48: null, d7: null } }), 'h24')).toBe(6);
    expect(stationNewSnow(station({ change: { h24: { depthIn: null, sweIn: 0.3 }, h48: { depthIn: null, sweIn: null }, d7: { depthIn: null, sweIn: null } } }), 'h24')).toBe(0.3);
    expect(stationNewSnow(station({ change: { h24: { depthIn: null, sweIn: null }, h48: { depthIn: null, sweIn: null }, d7: { depthIn: null, sweIn: null } } }), 'd7')).toBeNull();
  });
});

describe('update times', () => {
  it("says when data refreshes in the resort's own time, through daylight saving", () => {
    expect(refreshCaption('America/Denver', new Date('2026-12-01T12:00:00Z'))).toBe('2:20am and 5:20pm MST');
    expect(refreshCaption('America/Denver', new Date('2026-07-01T12:00:00Z'))).toBe('3:20am and 6:20pm MDT');
    expect(refreshCaption('America/Los_Angeles', new Date('2026-12-01T12:00:00Z'))).toBe('1:20am and 4:20pm PST');
  });

  it("reads a snow station's clock as local standard time, all year", () => {
    expect(stationTimeIso('2026-12-02T07:00', 'America/Denver')).toBe('2026-12-02T07:00:00-07:00');
    expect(stationTimeIso('2026-07-02T07:00', 'America/Los_Angeles')).toBe('2026-07-02T07:00:00-08:00');
    expect(stationTimeIso('2026-12-02T15:00:00Z', 'America/Denver')).toBe('2026-12-02T15:00:00Z');
  });

  it('matches the cron lines in the update workflow, each with a backup 1-4 hours later', () => {
    const yml = readFileSync(new URL('../../.github/workflows/update.yml', import.meta.url), 'utf8');
    const crons = [...yml.matchAll(/cron: '(\d+) (\d+) \* \* \*'/g)].map(([, m, h]) => Number(h) * 60 + Number(m));
    expect(crons).toHaveLength(UPDATE_TIMES_UTC.length * 2);
    for (const { h, m } of UPDATE_TIMES_UTC) {
      expect(yml).toContain(`cron: '${m} ${h} * * *'`);
      expect(crons.some((c) => c - (h * 60 + m) >= 60 && c - (h * 60 + m) <= 240)).toBe(true);
    }
  });

  it('finds the latest slot, across midnight UTC', () => {
    expect(lastSlot(new Date('2026-11-02T18:57:00Z')).toISOString()).toBe('2026-11-02T09:20:00.000Z');
    expect(lastSlot(new Date('2026-11-02T06:18:00Z')).toISOString()).toBe('2026-11-02T00:20:00.000Z');
    expect(lastSlot(new Date('2026-11-02T00:10:00Z')).toISOString()).toBe('2026-11-01T09:20:00.000Z');
    expect(lastSlot(new Date('2026-11-02T09:20:00Z')).toISOString()).toBe('2026-11-02T09:20:00.000Z');
  });

  it('maps each cron line to its slot, a backup to the slot before it', () => {
    expect(slotOf('20 9 * * *')).toEqual({ h: 9, m: 20 });
    expect(slotOf('35 11 * * *')).toEqual({ h: 9, m: 20 });
    expect(slotOf('20 0 * * *')).toEqual({ h: 0, m: 20 });
    expect(slotOf('35 2 * * *')).toEqual({ h: 0, m: 20 });
  });

  it('skips a scheduled run only when a full update already ran since its slot', () => {
    const at = (iso: string) => new Date(iso);
    // 2026-11-02: GitHub dropped the 09:20 run, so its backup at 18:00 must update.
    expect(slotAlreadyUpdated(at('2026-11-02T18:00:00Z'), at('2026-11-02T06:19:21Z'), '35 11 * * *')).toBe(false);
    // The backup that comes after the slot's own (late) run.
    expect(slotAlreadyUpdated(at('2026-11-02T17:45:00Z'), at('2026-11-02T15:30:00Z'), '35 11 * * *')).toBe(true);
    // The slot's run when GitHub started the backup first.
    expect(slotAlreadyUpdated(at('2026-11-02T15:30:00Z'), at('2026-11-02T11:40:00Z'), '20 9 * * *')).toBe(true);
    // The evening run after the morning one.
    expect(slotAlreadyUpdated(at('2026-11-03T06:00:00Z'), at('2026-11-02T15:30:00Z'), '20 0 * * *')).toBe(false);
    expect(slotAlreadyUpdated(at('2026-11-03T06:00:00Z'), null, '20 0 * * *')).toBe(false);
  });

  it('replays 2026-11-03: an evening backup that starts after 09:20 is not the morning run', () => {
    // The four scheduled runs as GitHub started them, each about 7 hours late. Which evening
    // cron came first isn't known, so both orders are checked.
    for (const [first, second] of [['20 0 * * *', '35 2 * * *'], ['35 2 * * *', '20 0 * * *']]) {
      let last = new Date('2026-11-02T19:14:18Z');
      const runs = [['2026-11-03T06:55:23Z', first], ['2026-11-03T09:59:44Z', second], ['2026-11-03T17:04:13Z', '20 9 * * *'], ['2026-11-03T18:38:04Z', '35 11 * * *']];
      const decisions = runs.map(([iso, cron]) => {
        const skip = slotAlreadyUpdated(new Date(iso), last, cron);
        if (!skip) last = new Date(iso);
        return skip ? 'skip' : 'update';
      });
      expect(decisions).toEqual(['update', 'skip', 'update', 'skip']);
    }
  });
});
