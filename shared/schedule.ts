// When the update job runs, for the "Data refreshes about…" line. GitHub cron is UTC, so the
// local times move with daylight saving and with each resort's time zone.

/** Keep in step with the cron lines in .github/workflows/update.yml (a test checks). */
export const UPDATE_TIMES_UTC: { h: number; m: number }[] = [
  { h: 13, m: 20 },
  { h: 0, m: 20 },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** "about 6:20am and 5:20pm MST": the update times at the resort, earliest first, on `ref`'s day. */
export function refreshCaption(tz: string, ref: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  const day = ref.toISOString().slice(0, 10);
  const local = UPDATE_TIMES_UTC.map(({ h, m }) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(`${day}T${pad(h)}:${pad(m)}:00Z`)).map((x) => [x.type, x.value]));
    const pm = p.dayPeriod === 'PM';
    return { minutes: ((Number(p.hour) % 12) + (pm ? 12 : 0)) * 60 + Number(p.minute), text: `${p.hour}:${p.minute}${pm ? 'pm' : 'am'}`, zone: p.timeZoneName };
  }).sort((a, b) => a.minutes - b.minutes);
  return `about ${local.map((t) => t.text).join(' and ')} ${local[0].zone}`;
}
