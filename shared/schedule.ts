// When the update job is scheduled, for the "Updates are scheduled for…" line and for the
// workflow's check that skips a backup run. GitHub cron is UTC, so the local times move with
// daylight saving and with each resort's time zone. GitHub usually starts scheduled runs a
// few hours late, so these are the earliest times data lands.

/** Keep in step with the cron lines in .github/workflows/update.yml (a test checks). Each has a backup cron after it. */
export const UPDATE_TIMES_UTC: { h: number; m: number }[] = [
  { h: 9, m: 20 },
  { h: 0, m: 20 },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** The latest update slot at or before `now`. */
export function lastSlot(now: Date): Date {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const times = [-1, 0].flatMap((d) => UPDATE_TIMES_UTC.map(({ h, m }) => day + d * 86_400_000 + (h * 60 + m) * 60_000));
  return new Date(Math.max(...times.filter((t) => t <= now.getTime())));
}

/**
 * GitHub sometimes drops a scheduled run (it dropped the 09:20 run on 2026-11-02), so each slot
 * has a backup cron. A scheduled run skips when a full update already ran since the latest
 * slot: the backup after the slot's own run, or the slot's run when GitHub started the backup first.
 */
export function slotAlreadyUpdated(now: Date, lastRun: Date | null): boolean {
  return lastRun !== null && lastRun.getTime() >= lastSlot(now).getTime();
}

/** "2:20am and 5:20pm MST": the update times at the resort, earliest first, on `ref`'s day. */
export function refreshCaption(tz: string, ref: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  const day = ref.toISOString().slice(0, 10);
  const local = UPDATE_TIMES_UTC.map(({ h, m }) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(`${day}T${pad(h)}:${pad(m)}:00Z`)).map((x) => [x.type, x.value]));
    const pm = p.dayPeriod === 'PM';
    return { minutes: ((Number(p.hour) % 12) + (pm ? 12 : 0)) * 60 + Number(p.minute), text: `${p.hour}:${p.minute}${pm ? 'pm' : 'am'}`, zone: p.timeZoneName };
  }).sort((a, b) => a.minutes - b.minutes);
  return `${local.map((t) => t.text).join(' and ')} ${local[0].zone}`;
}
