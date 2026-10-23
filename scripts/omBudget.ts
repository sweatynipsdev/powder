// Before a push runs a full update: would it take Open-Meteo past its free daily (or
// hourly) limit? Reads the CI runs logged in logs/openmeteo.csv. Scheduled runs never ask.
//   npm run om-budget [-- <path to the log>]
// The workflow passes main's current log, not the push's checkout, so a scheduled run
// that finished while the push waited in the queue is counted.
// Writes defer=true|false to $GITHUB_OUTPUT; on defer the workflow skips the update and
// the push deploys with the next scheduled run.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../pipeline/config';
import { budgetCheck, DAY_LIMIT, HOUR_LIMIT, parseOmLog } from '../pipeline/sources/omBudget';
import { DET_WEIGHT, ENS_WEIGHT } from '../pipeline/sources/openMeteo';

const DEFAULT_LOG = fileURLToPath(new URL('../logs/openmeteo.csv', import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const log = process.argv[2] ?? DEFAULT_LOG;
  const rows = existsSync(log) ? parseOmLog(readFileSync(log, 'utf8')) : [];
  const c = budgetCheck(rows, new Date(), loadConfig().resorts.length * (DET_WEIGHT + ENS_WEIGHT));
  const n = (x: number) => x.toLocaleString('en-US');
  console.log(
    `Open-Meteo budget: ${n(c.day)} in 24 h (limit ${n(DAY_LIMIT)}), ${n(c.hour)} in 60 min (limit ${n(HOUR_LIMIT)}), this run ≈ ${n(c.estimate)} → ${c.defer ? 'defer' : 'ok'}`,
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `defer=${c.defer}\n`);
  if (c.defer && process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Deferred\n\nOpen-Meteo used ${n(c.day)} calls in the last 24 h. This push deploys with the next scheduled run.\n`,
    );
}
