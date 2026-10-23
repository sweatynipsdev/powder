import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reuseData } from '../../scripts/reuse-data';

function liveSite(ids: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'powder-live-'));
  mkdirSync(join(dir, 'resorts'));
  writeFileSync(join(dir, 'data.json'), JSON.stringify({ generatedAt: 'x', resorts: ids.map((id) => ({ id })) }));
  for (const id of ids) writeFileSync(join(dir, 'resorts', `${id}.json`), JSON.stringify({ id, marker: `live-${id}` }));
  return dir;
}

describe('reusing live data on a code-only push', () => {
  it('copies the live data as is', async () => {
    const out = mkdtempSync(join(tmpdir(), 'powder-out-'));
    await reuseData(['palisades', 'mammoth'], { dir: liveSite(['palisades', 'mammoth']) }, out);
    expect(JSON.parse(readFileSync(join(out, 'resorts', 'mammoth.json'), 'utf8')).marker).toBe('live-mammoth');
    expect(JSON.parse(readFileSync(join(out, 'data.json'), 'utf8')).generatedAt).toBe('x');
  });

  it('refuses when a resort is missing, so the workflow does a full run', async () => {
    const out = mkdtempSync(join(tmpdir(), 'powder-out-'));
    await expect(reuseData(['palisades', 'kirkwood'], { dir: liveSite(['palisades']) }, out)).rejects.toThrow('missing kirkwood');
    await expect(reuseData(['palisades'], { dir: mkdtempSync(join(tmpdir(), 'powder-empty-')) }, out)).rejects.toThrow('missing data.json, palisades');
  });
});
