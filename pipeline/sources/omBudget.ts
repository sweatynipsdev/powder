// Open-Meteo's free tier counts requests by size: 600 calls a minute, 5,000 an hour,
// 10,000 a day. One resort's two requests weigh about 54 calls, so 35 resorts fired at once
// would blow the per-minute limit. Every Open-Meteo request waits here for room first.

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
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private opts: {
      perMinute: number;
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
}

/** Below the 600/minute limit, with room for retries. */
export const omPacer = new OmPacer({ perMinute: 450, enabled: () => httpMode() !== 'replay' });
