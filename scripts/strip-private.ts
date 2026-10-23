// After the write-ups, before the build: take out the text that's input for the writer only,
// so the public data files on GitHub Pages don't republish it. That's a local forecaster's
// post (their words, per AGENTS.md) and Avalanche Canada's highlights and summaries (their
// terms say content may not be reproduced). The app never showed either.
//   npm run strip-private
// A later run that can't reach those sources carries the stripped data forward, so the writer
// gets no forecaster text that run rather than stale words.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResortData } from '../shared/types';
import { DEFAULT_OUT_DIR } from '../pipeline/run';

export function stripPrivate(r: ResortData): ResortData {
  const expert = r.expert?.data ? { ...r.expert, data: { ...r.expert.data, text: '' } } : r.expert;
  const av = r.avalanche?.data;
  const avalanche = av && av.publicText === false ? { ...r.avalanche!, data: { ...av, bottomLine: null, discussion: null } } : r.avalanche;
  return { ...r, expert, avalanche };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(process.env.POWDER_OUT_DIR || DEFAULT_OUT_DIR, 'resorts');
  let n = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const path = join(dir, f);
    const before = readFileSync(path, 'utf8');
    const after = JSON.stringify(stripPrivate(JSON.parse(before)));
    if (after !== before) {
      writeFileSync(path, after);
      n++;
    }
  }
  console.log(`Stripped writer-only text from ${n} resort file(s) in ${dir}`);
}
