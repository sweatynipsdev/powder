// Single source of "now" so fixture replays are deterministic.

let frozen: Date | null = process.env.POWDER_NOW ? new Date(process.env.POWDER_NOW) : null;

export function setNow(date: Date | null): void {
  frozen = date;
}

export function now(): Date {
  return frozen ? new Date(frozen) : new Date();
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Local wall-clock time in `tz` as "YYYY-MM-DDTHH:MM". */
export function localIso(date: Date, tz: string): string {
  const p = Object.fromEntries(formatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Local date in `tz` as "YYYY-MM-DD", shifted by `days`. */
export function localDate(date: Date, tz: string, days = 0): string {
  const d = localIso(date, tz).slice(0, 10);
  return days === 0 ? d : addDays(d, days);
}

/** Calendar arithmetic on "YYYY-MM-DD" strings. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekday(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}
