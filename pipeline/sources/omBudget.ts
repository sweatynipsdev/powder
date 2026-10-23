// Open-Meteo's free tier counts requests by size: 600 calls a minute, 5,000 an hour,
// 10,000 a day. One resort's two requests weigh about 54 calls, so 35 resorts fired at once
// would blow the per-minute limit. Every Open-Meteo request waits here for room first.
// It also waits for one of a few slots: bursts of ~17 big requests at once saw dropped
// connections on 2026-10-23, and a handful in flight still clears the minute's budget.
//
// The daily limit is guarded across runs: CI full runs log their weight to
// logs/openmeteo.csv, and a push that would push the day over budget is deferred.

import { appendFileSync, existsSync } from 'node:fs';
import { httpMode } from '../http';

/**
 * Open-Meteo's weight: locations × days/14 × variables/10, where variables already counts
 * every model or ensemble member (8 models × 9 variables = 72). Short requests count as 1.
 */
export function omWeight(p: { locations: number; days: number; variables: number }): number {
  return p.locations * Math.max(1, p.days / 14) * Math.max(1, p.variables / 10);
}

export class OmPacer {
  /** Weighted calls this run, for the job summary. */
  total = 0;
  private window: { at: number; weight: number }[] = [];
  private inFlight = 0;
  private queue: (() => void)[] = [];
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private opts: {
      perMinute: number;
      /** Requests running at once; unlimited when unset. */
      maxInFlight?: number;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
      /** Off when nothing goes over the network (fixture replay). */
      enabled?: () => boolean;
    },
  ) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async take(weight: number): Promise<void> {
    this.total += weight;
    if (this.opts.enabled && !this.opts.enabled()) return;
    for (;;) {
      const t = this.now();
      while (this.window.length && t - this.window[0].at >= 60_000) this.window.shift();
      const used = this.window.reduce((s, w) => s + w.weight, 0);
      // An empty window always admits, so one request bigger than the budget still goes.
      if (this.window.length === 0 || used + weight <= this.opts.perMinute) {
        this.window.push({ at: t, weight });
        return;
      }
      await this.sleep(this.window[0].at + 60_000 - t);
    }
  }

  /** Runs one request once a slot is free and the last minute has room for it. */
  async run<T>(weight: number, request: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      // Budget is taken after the slot, so the window records when the request really went.
      await this.take(weight);
      return await request();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.inFlight < (this.opts.maxInFlight ?? Infinity)) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    // A waiting request takes the slot over directly, first come first served.
    const next = this.queue.shift();
    if (next) next();
    else this.inFlight--;
  }
}

/** Below the 600/minute limit, with room for retries. */
export const omPacer = new OmPacer({ perMinute: 450, maxInFlight: 4, enabled: () => httpMode() !== 'replay' });

// --- Daily budget across runs -----------------------------------------------------

export const OM_LOG_HEADER = 'timestamp,trigger,weighted_calls';
/** Retries added 15% on the 2026-10-23 21:49 run (178 of 1,311). */
export const RETRY_MARGIN = 1.15;
/** Under the free 10,000/day and 5,000/hour, with room for a run that retries more than usual. */
export const DAY_LIMIT = 9_500;
export const HOUR_LIMIT = 4_900;

export interface OmLogRow {
  at: Date;
  trigger: string;
  weight: number;
}

export function parseOmLog(csv: string): OmLogRow[] {
  return csv
    .split('\n')
    .map((line) => line.trim().split(','))
    .filter((f) => f.length === 3)
    .map(([ts, trigger, w]) => ({ at: new Date(ts), trigger, weight: Number(w) }))
    .filter((r) => !Number.isNaN(r.at.getTime()) && Number.isFinite(r.weight));
}

export const omLogLine = (at: Date, trigger: string, weight: number): string => `${at.toISOString()},${trigger},${Math.round(weight)}`;

export function appendOmLog(path: string, at: Date, trigger: string, weight: number): void {
  if (!existsSync(path)) appendFileSync(path, `${OM_LOG_HEADER}\n`);
  appendFileSync(path, `${omLogLine(at, trigger, weight)}\n`);
}

/**
 * Whether a full run now would push the last 24 hours or 60 minutes over budget. `runWeight`
 * is the run's weight before retries (resorts × DET_WEIGHT + ENS_WEIGHT; the caller passes
 * it, since openMeteo.ts imports this module).
 */
export function budgetCheck(rows: OmLogRow[], now: Date, runWeight: number): { day: number; hour: number; estimate: number; defer: boolean } {
  const since = (ms: number) => rows.filter((r) => now.getTime() - r.at.getTime() < ms).reduce((s, r) => s + r.weight, 0);
  const day = since(86_400_000);
  const hour = since(3_600_000);
  const estimate = Math.round(runWeight * RETRY_MARGIN);
  return { day, hour, estimate, defer: day + estimate > DAY_LIMIT || hour + estimate > HOUR_LIMIT };
}
