// "Has the forecast materially changed?" Used by the afternoon run to skip rewriting.
// Small wiggles (a day going from 2.3" to 2.6") don't count; a storm appearing does.

import { createHash } from 'node:crypto';
import type { ResortData } from '../shared/types';

const snap = (x: number | null | undefined, step: number) => (x === null || x === undefined ? null : Math.round(x / step) * step);

export function fingerprint(r: ResortData): string {
  const f = r.forecast.data;
  const material = {
    days: f?.days.slice(0, 7).map((d) => snap(d.snow.summit.blend, 2)) ?? null,
    buckets: f ? [f.buckets.d1_5, f.buckets.d6_10, f.buckets.d11_16].map((b) => snap(b.summit.blend, 3)) : null,
    alerts: (r.alerts.data ?? []).map((a) => a.event).sort(),
    avalanche: r.avalanche?.data?.overall ?? null,
    cpc: r.cpc.data?.outlooks.slice(0, 2).map((o) => [o.temp?.cat ?? null, o.precip?.cat ?? null]) ?? null,
    roads: r.roads?.data?.worst ?? null,
    reported: r.report?.data?.fresh ? snap(r.report.data.h24, 2) : null,
  };
  return createHash('sha1').update(JSON.stringify(material)).digest('hex').slice(0, 12);
}
