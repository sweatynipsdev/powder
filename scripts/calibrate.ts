// Learns per-resort model corrections from the forecast/observation logs in history/.
//   npm run calibrate     writes history/calibration.json (the pipeline applies it)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCalibration, loadObservations, loadSnapshots, MIN_EVENTS, writeCalibration } from '../pipeline/history';

const dir = process.env.POWDER_HISTORY_DIR || fileURLToPath(new URL('../history', import.meta.url));
const snaps = loadSnapshots(dir);
const obs = loadObservations(dir);
const cal = computeCalibration(snaps, obs);
mkdirSync(dir, { recursive: true });
writeCalibration(join(dir, 'calibration.json'), cal, new Date());

const lines = Object.entries(cal).flatMap(([resort, models]) =>
  Object.entries(models).map(([id, c]) => `  ${resort} ${id}: ×${c!.factor} (${c!.events} events)`),
);
console.log(
  `Calibration from ${snaps.length} forecasts and ${obs.length} observations.\n` +
    (lines.length ? lines.join('\n') : `  No model has ${MIN_EVENTS}+ snow events yet; blends are unadjusted.`),
);
