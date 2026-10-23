// Derived facts shared by the pipeline summary, the written brief and the app, so all three
// say the same thing about whether a resort is open and how much snow just fell.

import type { Last24, ReportData, ResortStatus, SnowpackData } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

/** A report older than this means the resort is closed (off-season), not just slow to update. */
export const CLOSED_AFTER_DAYS = 14;

export function resortOpenStatus(report: ReportData | null | undefined, now: Date, openingDate?: string): ResortStatus {
  const open = report?.fresh && report.liftsOpen;
  // Before the scheduled opening day, say so (unless lifts are already turning).
  if (!open && openingDate && Date.parse(`${openingDate}T23:59:59Z`) > now.getTime())
    return { state: 'not-open', text: `Opening ${shortDate(openingDate)}` };
  if (!report) return { state: 'unknown', text: 'No resort report' };
  if (!report.fresh) {
    if (!report.updatedAt) return { state: 'unknown', text: 'No current report' };
    const days = Math.floor((now.getTime() - Date.parse(report.updatedAt)) / 86_400_000);
    return days > CLOSED_AFTER_DAYS
      ? { state: 'closed', text: `Closed · last report ${shortDate(report.updatedAt)}` }
      : { state: 'unknown', text: `Report ${days} days old` };
  }
  if (!report.liftsTotal) return { state: 'unknown', text: report.operatingStatus ?? 'Status unknown' };
  return report.liftsOpen
    ? { state: 'open', text: `Open · ${report.liftsOpen}/${report.liftsTotal} lifts` }
    : { state: 'not-open', text: 'Not open yet' };
}

export function last24(report: ReportData | null | undefined, snowpack: SnowpackData | null | undefined): Last24 {
  if (report?.fresh && report.h24 !== null) return { inches: report.h24, source: 'reported', at: report.updatedAt };
  if (snowpack?.newSnow?.h24 !== null && snowpack?.newSnow?.h24 !== undefined)
    return { inches: snowpack.newSnow.h24, source: 'estimated', at: snowpack.observedAt };
  const gain = snowpack?.change.h24.depthIn;
  if (gain !== null && gain !== undefined) return { inches: Math.max(0, gain), source: 'estimated', at: snowpack!.observedAt };
  return { inches: null, source: null, at: null };
}

/** New snow by day from a station: measured by an observer, or estimated from depth gains. */
export function stationDailySnow(snowpack: SnowpackData | null | undefined): { date: string; inches: number | null }[] {
  const s = snowpack?.series ?? [];
  return s.map((d, i) => {
    if (d.newIn !== undefined && d.newIn !== null) return { date: d.date, inches: d.newIn };
    const prev = s[i - 1]?.depthIn;
    return { date: d.date, inches: d.depthIn === null || prev === null || prev === undefined ? null : Math.max(0, d.depthIn - prev) };
  });
}
