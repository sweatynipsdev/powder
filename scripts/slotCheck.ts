// Before a scheduled update: has a full update already run since this slot's time? Each slot
// has a backup cron in case GitHub drops the run, and this keeps the two from both spending a
// full update. Pushes and manual runs never ask.
//   npm run slot-check [-- <path to the log>]
// The workflow passes main's current logs/openmeteo.csv, where every full update in CI adds a
// row as it finishes, so a run that finished while this one waited in the queue is counted.
// SCHEDULE is the cron line that fired (github.event.schedule), which says which slot this run
// is for. Writes skip=true|false to $GITHUB_OUTPUT.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOmLog } from '../pipeline/sources/omBudget';
import { lastSlot, slotAlreadyUpdated, slotOf } from '../shared/schedule';

const DEFAULT_LOG = fileURLToPath(new URL('../logs/openmeteo.csv', import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const log = process.argv[2] ?? DEFAULT_LOG;
  const rows = existsSync(log) ? parseOmLog(readFileSync(log, 'utf8')) : [];
  const last = rows.length ? new Date(Math.max(...rows.map((r) => r.at.getTime()))) : null;
  const now = new Date();
  const cron = process.env.SCHEDULE || undefined;
  const slot = lastSlot(now, cron ? slotOf(cron) : undefined).toISOString();
  const skip = slotAlreadyUpdated(now, last, cron);
  console.log(`Cron '${cron ?? 'none'}', slot ${slot}, last full update ${last?.toISOString() ?? 'unknown'} → ${skip ? 'skip' : 'update'}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `skip=${skip}\n`);
  if (skip && process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Skipped\n\nA full update already ran at ${last!.toISOString()}, after this slot's ${slot}.\n`);
}
