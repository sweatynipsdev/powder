// UI-only formatting. Snow numbers come from shared/format so cards, charts and the
// written analysis always show the same values.

import type { AvalancheData, RoadStatus } from '../../shared/types';

export { fmtDay, fmtFt, fmtSnow, fmtSnowAmount, fmtSnowRange } from '../../shared/format';

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'unknown';
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function clockTime(iso: string | null | undefined, tz = 'America/Los_Angeles'): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Local wall-clock "2026-10-23T05:00" → "Fri 5am". */
export function periodTime(local: string): string {
  const [date, time] = local.split('T');
  const h = Number(time.slice(0, 2));
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}

export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral';

export const ROAD_STATUS: Record<RoadStatus, { tone: StatusTone; label: string; icon: string }> = {
  clear: { tone: 'good', label: 'No chain controls', icon: '✓' },
  advisory: { tone: 'warning', label: 'Traction tires advised', icon: '⛓' },
  'R-1': { tone: 'warning', label: 'Chains R-1', icon: '⛓' },
  'R-2': { tone: 'serious', label: 'Chains R-2', icon: '⛓' },
  'R-3': { tone: 'critical', label: 'Chains R-3', icon: '⛓' },
  closed: { tone: 'critical', label: 'Closed', icon: '⛔' },
  unknown: { tone: 'neutral', label: 'Unknown', icon: '?' },
};

/** North American danger scale mapped onto the reserved status tones. */
export function avalancheTone(level: number): StatusTone {
  if (level <= 0) return 'neutral';
  if (level === 1) return 'good';
  if (level === 2) return 'warning';
  if (level === 3) return 'serious';
  return 'critical';
}

export const DANGER_LABEL = ['No rating', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'];

export function dangerText(a: AvalancheData | null | undefined): string {
  if (!a) return '—';
  return a.overall >= 0 ? `${a.overall} · ${a.overallText}` : a.overallText;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg: number | null | undefined) => (deg === null || deg === undefined ? '' : COMPASS[Math.round(deg / 22.5) % 16]);

/** "2026-10-23T14:00" → "2p". */
export function hourLabel(stamp: string): string {
  const h = Number(stamp.slice(11, 13));
  return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function weekdayOf(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export const isWeekend = (ymd: string) => ['Sat', 'Sun'].includes(weekdayOf(ymd));
export const dayNum = (ymd: string) => Number(ymd.slice(8, 10));

/** OpenSnow-style emphasis: a big 24h total (or 12h period) shows in orange. */
export const BIG_DAY_IN = 6;
export const BIG_PERIOD_IN = 4;

export const QUALITY_LABEL = { excellent: 'Excellent', good: 'Good', okay: 'Okay' } as const;

/** "3.5" → "3.5", "4.0" → "4". */
export const num = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? '—' : String(Math.round(n * 10 ** digits) / 10 ** digits);

export const signed = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${num(n)}`);
