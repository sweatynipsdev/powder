// A push that only changes the app rebuilds it against the data already live, instead of
// fetching every source and rewriting every forecast again (which would spend Open-Meteo's
// daily budget and AI tokens for nothing).
//   PREVIOUS_DATA_URL=https://<you>.github.io/powder/data/ npm run reuse-data
// Fails if the live data is missing any resort, so the workflow falls back to a full run.

import { fileURLToPath } from 'node:url';
import { loadConfig } from '../pipeline/config';
import { loadPrevious } from '../pipeline/previous';
import { DEFAULT_OUT_DIR, writeOutput } from '../pipeline/run';

export async function reuseData(ids: string[], source: { url?: string; dir?: string }, outDir: string): Promise<void> {
  const prev = await loadPrevious(ids, source);
  const missing = [...(prev.index ? [] : ['data.json']), ...ids.filter((id) => !prev.resorts.has(id))];
  if (missing.length) throw new Error(`live data incomplete: missing ${missing.join(', ')}`);
  writeOutput(outDir, { index: prev.index!, resorts: ids.map((id) => prev.resorts.get(id)!) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.PREVIOUS_DATA_URL;
  if (!url) throw new Error('PREVIOUS_DATA_URL is required');
  const ids = loadConfig().resorts.map((r) => r.id);
  const outDir = process.env.POWDER_OUT_DIR || DEFAULT_OUT_DIR;
  reuseData(ids, { url }, outDir)
    .then(() => console.log(`Reused live data for ${ids.length} resorts from ${url} → ${outDir}`))
    .catch((e) => {
      console.error(String(e));
      process.exit(1);
    });
}
