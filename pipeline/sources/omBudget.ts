// Open-Meteo's free tier counts requests by size: 600 calls a minute, 5,000 an hour,
// 10,000 a day. One resort's two requests weigh about 54 calls, so 35 resorts fired at once
// would blow the per-minute limit. Every Open-Meteo request waits here for room first.
// It also waits for one of a few slots: bursts of ~17 big requests at once saw dropped
// connections on 2026-10-23, and a handful in flight still clears the minute's budget.

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
