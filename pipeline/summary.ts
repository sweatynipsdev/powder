// Builds the small data.json the home screen loads, plus a console/Actions status table.

import type { DataIndex, ResortData, ResortSummary, SourceKey, SourceStatus } from '../shared/types';

const SOURCE_KEYS: SourceKey[] = ['forecast', 'cpc', 'snowpack', 'nws', 'alerts', 'afd', 'avalanche', 'roads', 'report'];

export const STRIP_DAYS = 10;

function sourceStatuses(r: ResortData): Partial<Record<SourceKey, SourceStatus>> {
  const out: Partial<Record<SourceKey, SourceStatus>> = {};
  for (const k of SOURCE_KEYS) {
    const s = r[k];
    if (s) out[k] = s.status;
  }
  return out;
}

export function summarize(r: ResortData): ResortSummary {
  const f = r.forecast.data;
  const report = r.report?.data;
  const statuses = sourceStatuses(r);
  return {
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    region: r.region,
    baseFt: r.baseFt,
    summitFt: r.summitFt,
    windows: f?.windows ?? null,
    strip: (f?.periods ?? []).slice(0, STRIP_DAYS * 2).map((p) => ({
      date: p.date,
      kind: p.kind,
      label: p.label,
      snowIn: p.snow.summit.blend,
    })),
    reported: report ? { h24: report.h24, updatedAt: report.updatedAt, fresh: report.fresh } : null,
    alerts: (r.alerts.data ?? []).map((a) => ({ event: a.event, headline: a.headline, winter: a.winter })),
    avalanche: r.avalanche?.data ? { overall: r.avalanche.data.overall, text: r.avalanche.data.overallText } : null,
    roads: r.roads?.data?.worst ?? null,
    headline: r.analysis?.headline ?? null,
    staleSources: (Object.entries(statuses) as [SourceKey, SourceStatus][]).filter(([, s]) => !s.ok).map(([k]) => k),
  };
}

export function buildIndex(resorts: ResortData[], at: Date, previous: DataIndex | null): DataIndex {
  return {
    generatedAt: at.toISOString(),
    resorts: resorts.map(summarize),
    enso: resorts.find((r) => r.cpc.data?.enso)?.cpc.data?.enso ?? previous?.enso ?? null,
    ranking: previous?.ranking ?? null,
    usage: previous?.usage ?? null,
    sources: Object.fromEntries(resorts.map((r) => [r.id, sourceStatuses(r)])),
  };
}

function cell(s: SourceStatus | undefined): string {
  if (!s) return '–';
  if (s.ok) return '✓';
  return s.stale ? 'stale' : '✗';
}

/** Markdown table of source status per resort, plus error details. */
export function statusTable(resorts: ResortData[]): string {
  const header = `| resort | ${SOURCE_KEYS.join(' | ')} |\n|---|${SOURCE_KEYS.map(() => '---').join('|')}|`;
  const rows = resorts.map((r) => `| ${r.shortName} | ${SOURCE_KEYS.map((k) => cell(r[k]?.status)).join(' | ')} |`);
  const errors = resorts.flatMap((r) =>
    SOURCE_KEYS.flatMap((k) => {
      const s = r[k]?.status;
      return s?.error ? [`- **${r.shortName} / ${k}**: ${s.error}`] : [];
    }),
  );
  return [header, ...rows, ...(errors.length ? ['', ...errors] : [])].join('\n');
}
