// Display formatting shared by the app and the analysis brief, so the written forecast
// quotes exactly the numbers the charts and cards show.

import type { Range, SnowAmount } from './types';

/** Whole inches like OpenSnow; anything measurable under half an inch is "<1". */
export function fmtSnow(x: number | null | undefined): string {
  if (x === null || x === undefined) return 'n/a';
  if (x <= 0.04) return '0';
  if (x < 0.5) return '<1';
  return String(Math.round(x));
}

/** Ranges widen outward to whole inches: 0.2–3.6 → "0-4". */
export function fmtSnowRange(r: Range | null | undefined): string {
  if (!r) return 'n/a';
  const lo = Math.floor(r.lo + 0.05);
  const hi = Math.max(lo, Math.ceil(r.hi - 0.05));
  return lo === hi ? String(lo) : `${lo}-${hi}`;
}

/** "3 (1-5)" — blend with its range. */
export function fmtSnowAmount(a: SnowAmount | null | undefined): string {
  if (!a || a.blend === null) return 'n/a';
  return a.range ? `${fmtSnow(a.blend)} (${fmtSnowRange(a.range)})` : fmtSnow(a.blend);
}

export function fmtFt(x: number | null | undefined): string {
  return x === null || x === undefined ? 'n/a' : Math.round(x).toLocaleString('en-US');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-23" → "Fri Oct 23". */
export function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]} ${MONTHS[m - 1]} ${d}`;
}
