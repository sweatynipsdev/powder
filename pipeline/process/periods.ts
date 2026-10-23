// OpenSnow-style periods: day = 5am–5pm, night = 5pm–5am (local).
// Hourly values from Open-Meteo are "preceding hour" sums, so the value stamped 06:00
// covers 05:00–06:00. A day period therefore uses stamps 06:00…17:00 and a night period
// uses 18:00…05:00 the next morning.

import { addDays, weekday } from '../clock';

export interface PeriodSlot {
  kind: 'day' | 'night';
  date: string;
  start: string;
  end: string;
  label: string;
  /** Day number from the first period's date (0 = today). */
  dayIndex: number;
  /** Indices into the hourly time axis. */
  hours: number[];
}

const pad = (n: number) => String(n).padStart(2, '0');

function stamps(kind: 'day' | 'night', date: string): string[] {
  if (kind === 'day') return Array.from({ length: 12 }, (_, i) => `${date}T${pad(6 + i)}:00`);
  const next = addDays(date, 1);
  return [
    ...Array.from({ length: 6 }, (_, i) => `${date}T${pad(18 + i)}:00`),
    ...Array.from({ length: 6 }, (_, i) => `${next}T${pad(i)}:00`),
  ];
}

export function buildPeriods(times: string[], firstDate: string, days: number): PeriodSlot[] {
  const index = new Map(times.map((t, i) => [t, i]));
  const slots: PeriodSlot[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(firstDate, d);
    for (const kind of ['day', 'night'] as const) {
      const hours = stamps(kind, date)
        .map((s) => index.get(s))
        .filter((i): i is number => i !== undefined);
      slots.push({
        kind,
        date,
        start: `${date}T${kind === 'day' ? '05' : '17'}:00`,
        end: kind === 'day' ? `${date}T17:00` : `${addDays(date, 1)}T05:00`,
        label: kind === 'day' ? weekday(date) : `${weekday(date)} night`,
        dayIndex: d,
        hours,
      });
    }
  }
  return slots;
}

/** Hour indices strictly after `fromStamp` and up to `hours` later. */
export function windowHours(times: string[], fromStamp: string, hours: number): number[] {
  const start = times.findIndex((t) => t > fromStamp);
  if (start < 0) return [];
  return Array.from({ length: hours }, (_, i) => start + i).filter((i) => i < times.length);
}
