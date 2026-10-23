import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reuseData } from '../../scripts/reuse-data';
import { stripPrivate } from '../../scripts/strip-private';
import type { ResortData } from '../../shared/types';

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

describe('stripping writer-only text before deploy', () => {
  const base = { id: 'x', expert: null, avalanche: null } as unknown as ResortData;
  const ok = { ok: true, stale: false, fetchedAt: 'x' };

  it("blanks a local forecaster's words but keeps who, when and the link", () => {
    const data = { source: 'The Snowman', author: 'Pat Doe', title: 't', url: 'https://example.com', publishedAt: 'p', excerpt: "Pat Doe's local forecast", text: 'Their words.' };
    expect(stripPrivate({ ...base, expert: { status: ok, data } }).expert!.data).toEqual({ ...data, text: '' });
  });

  it("drops Avalanche Canada's text and leaves avalanche.org's", () => {
    const av = (publicText?: boolean) => ({
      status: ok,
      data: {
        center: 'c', zoneName: 'z', url: 'u', productType: 'p', publishedAt: null, expiresAt: null, current: null, tomorrow: null,
        overall: 2, overallText: 'Moderate', bottomLine: 'Their highlights.', discussion: 'Their summaries.', problems: ['Wind Slab'], publicText,
      },
    });
    expect(stripPrivate({ ...base, avalanche: av(false) }).avalanche!.data).toMatchObject({ bottomLine: null, discussion: null, overall: 2, problems: ['Wind Slab'] });
    expect(stripPrivate({ ...base, avalanche: av(true) }).avalanche!.data).toMatchObject({ bottomLine: 'Their highlights.', discussion: 'Their summaries.' });
    expect(stripPrivate({ ...base, avalanche: av(undefined) }).avalanche!.data!.bottomLine).toBe('Their highlights.');
  });
});
