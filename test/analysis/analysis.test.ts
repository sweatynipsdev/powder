import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildBrief, buildRankingBrief, resortStatus, snowLevelMeaning } from '../../analysis/brief';
import { fingerprint } from '../../analysis/fingerprint';
import { allowedNumbers, extractClaims, findUngrounded, metaReferences } from '../../analysis/grounding';
import { RESORT_SYSTEM } from '../../analysis/prompt';
import { analyze, needsRewrite, usageRun } from '../../analysis/run';
import { appendUsageCsv, costUsd, monthToDate } from '../../analysis/usage';
import type { Caller, CallResult } from '../../analysis/writer';
import { setNow } from '../../pipeline/clock';
import { loadConfig } from '../../pipeline/config';
import { configureHttp } from '../../pipeline/http';
import { EMPTY_PREVIOUS } from '../../pipeline/previous';
import { runPipeline } from '../../pipeline/run';
import { fmtSnow, fmtSnowAmount, fmtSnowRange } from '../../shared/format';
import type { ResortData } from '../../shared/types';
import { FIXTURE_DIR, recordedAt } from '../helpers';

let resorts: ResortData[];
let palisades: ResortData;

beforeAll(async () => {
  configureHttp({ mode: 'replay', dir: FIXTURE_DIR, failPattern: null, retryDelaysMs: [] });
  setNow(recordedAt);
  resorts = (await runPipeline(loadConfig(), EMPTY_PREVIOUS, recordedAt)).resorts;
  palisades = resorts.find((r) => r.id === 'palisades')!;
});

describe('display formatting', () => {
  it('rounds snow to whole inches with "<1" for a dusting', () => {
    expect([fmtSnow(0), fmtSnow(0.3), fmtSnow(0.5), fmtSnow(2.6), fmtSnow(null)]).toEqual(['0', '<1', '1', '3', 'n/a']);
  });
  it('widens ranges outward', () => {
    expect(fmtSnowRange({ lo: 0.2, hi: 3.6 })).toBe('0-4');
    expect(fmtSnowRange({ lo: 0, hi: 0 })).toBe('0');
    expect(fmtSnowRange({ lo: 4.0, hi: 6.0 })).toBe('4-6');
  });
  it('pairs blend and range', () => {
    expect(fmtSnowAmount({ blend: 3.2, range: { lo: 1.4, hi: 5.1 }, rangeSource: 'ensemble', p10: 0, p90: 8, models: {}, rawBlend: 2 })).toBe('3 (1-6)');
  });
});

describe('brief', () => {
  it('is compact structured data, not raw arrays', () => {
    const b = buildBrief(palisades, recordedAt);
    const parsed = JSON.parse(b.json);
    expect(parsed.next5Days).toHaveLength(5);
    expect(parsed.days6to16).toHaveLength(11);
    expect(b.json.length).toBeLessThan(16_000);
    expect(b.json).not.toMatch(/"precip"|"temp":\s*\[|"hourly"/);
    expect(parsed.observed.resortReport.current).toMatch(/^NO/); // the June report is flagged stale
  });

  it('keeps the system prompt above the 512-token cache minimum and free of per-run data', () => {
    expect(RESORT_SYSTEM.length / 4).toBeGreaterThan(512);
    expect(RESORT_SYSTEM).not.toMatch(/2026|Palisades|Mammoth/);
  });

  it('spells out what the snow level means on the mountain', () => {
    expect(snowLevelMeaning(11_500, 11_800, 7953, 11_053)).toMatch(/rain on the whole mountain/);
    expect(snowLevelMeaning(5000, 6000, 6200, 9050)).toMatch(/snow top to bottom/);
    expect(snowLevelMeaning(7200, 7700, 6200, 9050)).toMatch(/snow up high/);
    expect(snowLevelMeaning(null, null, 6200, 9050)).toBe('n/a');
  });

  it('states whether the resort is open', () => {
    expect(resortStatus(palisades, recordedAt)).toMatch(/^not open: the last resort report is from Mon Jun 8/);
    const mammoth = resorts.find((r) => r.id === 'mammoth')!;
    expect(resortStatus(mammoth, recordedAt)).toBe('not open yet: 0 of 25 lifts running');
    const open = structuredClone(mammoth);
    open.report!.data!.liftsOpen = 12;
    expect(resortStatus(open, recordedAt)).toBe('open: 12 of 25 lifts running');
  });

  it('tells the writer which part of the forecast discussion applies', () => {
    const b = JSON.parse(buildBrief(palisades, recordedAt).json);
    expect(b.nwsDiscussion.appliesTo).toMatch(/Lake Tahoe and the Sierra crest near I-80/);
    expect(b.snowOnGround).toMatch(/none at the Palisades Tahoe SNOTEL station/);
  });

  it('builds a ranking brief for every resort', () => {
    const parsed = JSON.parse(buildRankingBrief(resorts, recordedAt));
    expect(parsed.resorts.map((r: { id: string }) => r.id)).toEqual(['palisades', 'alpine', 'mammoth', 'bigbear']);
    expect(parsed.resorts[0].next7Days).toHaveLength(7);
  });
});

describe('grounding', () => {
  it('extracts unit-tagged numbers and ranges, not day counts', () => {
    const claims = extractClaims('Expect 3-6 inches by Saturday, snow levels near 7,000 feet, gusts to 45 mph, a 40% chance, highs of 28°F over the next 5 days.');
    expect(claims.map((c) => [c.unit, c.values])).toEqual([
      ['in', [3, 6]],
      ['ft', [7000]],
      ['mph', [45]],
      ['pct', [40]],
      ['F', [28]],
    ]);
  });

  const brief = JSON.stringify({
    next5Days: [{ summitSnow: { total: '4 (2-6)' }, snowLevelFt: '7,200 to 7,700', summitTempF: '18 to 30', maxGustMph: 45 }],
    cpcOutlooks: [{ precipitation: 'above normal (50% chance)' }],
    nwsDiscussion: { discussion: 'ridge gusts of 50-60 mph over the crest' },
  });

  it('sorts the brief’s numbers by unit', () => {
    const a = allowedNumbers(brief);
    expect(a.in).toEqual(expect.arrayContaining([4, 2, 6]));
    expect(a.ft).toEqual([7200, 7700]);
    expect(a.F).toEqual([18, 30]);
    expect(a.pct).toContain(50);
    expect(a.any).toEqual(expect.arrayContaining([50, 60]));
  });

  it('accepts quoted and rounded numbers', () => {
    expect(findUngrounded(['2-6 inches, around 4" up top, snow level near 7,000 feet, gusts to 45 mph, 50% odds, ridge gusts near 60 mph'], brief)).toEqual([]);
  });

  it('catches an invented total, even when the number exists with another unit', () => {
    expect(findUngrounded(['Totals could reach 18 inches by Sunday.'], brief)).toEqual(['18 inches']);
    expect(findUngrounded(['That adds up to 10" for the week.'], brief)).toEqual(['10"']);
  });

  it('flags write-ups that talk about their input', () => {
    expect(metaReferences(['The brief shows 1 inch.', 'Per the JSON, dry.'])).toEqual(['the brief', 'json']);
    expect(metaReferences(['A brief shower Friday.'])).toEqual([]);
    expect(metaReferences(['A wetScenario of 36, and days6to10Summit shows 8.'])).toEqual(['wetScenario', 'days6to10Summit']);
  });

  it('catches a planted number against a real brief', () => {
    const b = buildBrief(palisades, recordedAt);
    expect(findUngrounded(['A huge storm drops 47 inches Thursday.'], b.json)).toEqual(['47 inches']);
  });
});

describe('fingerprint', () => {
  it('ignores small wiggles and notices a storm', () => {
    const base = fingerprint(palisades);
    const tweak = structuredClone(palisades);
    tweak.forecast.data!.days[1].snow.summit.blend! += 0.3;
    expect(fingerprint(tweak)).toBe(base);
    const storm = structuredClone(palisades);
    storm.forecast.data!.days[2].snow.summit.blend = 14;
    expect(fingerprint(storm)).not.toBe(base);
  });
});

describe('rewrite schedule', () => {
  const morning = new Date('2026-10-23T13:20:00Z'); // 6:20am PDT
  const afternoon = new Date('2026-10-23T23:20:00Z'); // 4:20pm PDT
  const withAnalysis = (generatedAt: string, fp: string) => ({
    ...palisades,
    analysis: { generatedAt, model: 'm', headline: 'h', next5Days: '', extended6to16: '', modelAgreement: { summary: '', confidence: 'low' as const }, whatToWatch: '', ungrounded: [], fingerprint: fp },
  });

  it('always rewrites in the morning', () => expect(needsRewrite(withAnalysis(morning.toISOString(), fingerprint(palisades)), 'auto', morning).rewrite).toBe(true));
  it('skips an unchanged afternoon', () =>
    expect(needsRewrite(withAnalysis('2026-10-23T13:20:00Z', fingerprint(palisades)), 'auto', afternoon)).toEqual({ rewrite: false, reason: 'unchanged' }));
  it('rewrites a changed afternoon', () => expect(needsRewrite(withAnalysis('2026-10-23T13:20:00Z', 'different'), 'auto', afternoon).reason).toBe('forecast changed'));
  it('rewrites when the last analysis is old', () => expect(needsRewrite(withAnalysis('2026-10-22T13:20:00Z', fingerprint(palisades)), 'auto', afternoon).reason).toBe('analysis is old'));
  it('writes nothing without forecast data', () => expect(needsRewrite({ ...palisades, forecast: { ...palisades.forecast, data: null } }, 'force', morning).rewrite).toBe(false));
});

const USAGE = { inputTokens: 4000, cacheReadTokens: 1000, cacheWriteTokens: 0, outputTokens: 800 };

/** Fake API: returns canned analyses keyed by call order. */
function fakeCaller(outputs: (Record<string, unknown> | 'refusal')[]): Caller & { users: string[] } {
  const users: string[] = [];
  let i = 0;
  const fn = (async (req: { user: string }) => {
    users.push(req.user);
    const out = outputs[Math.min(i++, outputs.length - 1)];
    if (out === 'refusal') return { parsed: null, stopReason: 'refusal', usage: USAGE } satisfies CallResult<unknown>;
    return { parsed: out, stopReason: 'end_turn', usage: USAGE } satisfies CallResult<unknown>;
  }) as unknown as Caller & { users: string[] };
  fn.users = users;
  return fn;
}

const good = {
  headline: 'Dry weekend, watching next week',
  next5Days: 'Mostly dry with less than an inch up top Friday.',
  extended6to16: 'A pattern change is possible early November but confidence is low.',
  modelAgreement: { summary: 'Models agree on a dry stretch.', confidence: 'high' },
  whatToWatch: 'Whether the early-November storm holds together.',
};
const ranking = { bestResort: 'mammoth', bestDay: '2026-10-23', summary: 'Nothing big this week.', ranking: [] };

describe('analyze', () => {
  it('writes every resort plus the ranking on a forced run, sequentially', async () => {
    const caller = fakeCaller([good, good, good, good, ranking]);
    const res = await analyze(resorts, null, { caller, model: 'claude-haiku-5-5', at: recordedAt, mode: 'force' });
    expect(res.regenerated).toEqual(['palisades', 'alpine', 'mammoth', 'bigbear']);
    expect(res.resorts.every((r) => r.analysis?.headline === good.headline)).toBe(true);
    expect(res.ranking?.bestResort).toBe('mammoth');
    expect(res.calls.map((c) => c.label)).toEqual(['palisades#1', 'alpine#1', 'mammoth#1', 'bigbear#1', 'ranking#1']);
  });

  it('retries once when the draft invents a number, naming it', async () => {
    const invented = { ...good, next5Days: 'Look for 47 inches Friday.' };
    const caller = fakeCaller([invented, good, good, good, good, ranking]);
    const res = await analyze(resorts.slice(0, 1), null, { caller, model: 'm', at: recordedAt, mode: 'force' });
    expect(caller.users[1]).toMatch(/47 inches/);
    expect(res.resorts[0].analysis!.ungrounded).toEqual([]);
    expect(res.calls.map((c) => c.label)).toEqual(['palisades#1', 'palisades#2', 'ranking#1']);
  });

  it('retries when the draft mentions the brief', async () => {
    const meta = { ...good, next5Days: 'The brief shows a dry week.' };
    const caller = fakeCaller([meta, good, ranking]);
    await analyze(resorts.slice(0, 1), null, { caller, model: 'm', at: recordedAt, mode: 'force' });
    expect(caller.users[1]).toMatch(/mentioned "the brief"/);
  });

  it('publishes with a flag if the retry still invents numbers', async () => {
    const invented = { ...good, next5Days: 'Look for 47 inches Friday.' };
    const res = await analyze(resorts.slice(0, 1), null, { caller: fakeCaller([invented, invented, ranking]), model: 'm', at: recordedAt, mode: 'force' });
    expect(res.resorts[0].analysis!.ungrounded).toEqual(['47 inches']);
  });

  it('keeps the previous analysis when the model declines', async () => {
    const prev = { ...palisades, analysis: { generatedAt: 'x', model: 'm', ...good, modelAgreement: { summary: 's', confidence: 'low' as const }, ungrounded: [], fingerprint: 'f' } };
    const res = await analyze([prev], null, { caller: fakeCaller(['refusal', ranking]), model: 'm', at: recordedAt, mode: 'force' });
    expect(res.failed).toEqual([{ id: 'palisades', error: 'model declined the request' }]);
    expect(res.resorts[0].analysis).toBe(prev.analysis);
  });

  it('makes no calls on an unchanged afternoon', async () => {
    const afternoon = new Date('2026-10-23T23:20:00Z');
    const done = resorts.map((r) => ({ ...r, analysis: { generatedAt: '2026-10-23T13:20:00Z', model: 'm', ...good, modelAgreement: { summary: 's', confidence: 'low' as const }, ungrounded: [], fingerprint: fingerprint(r) } }));
    const prevRanking = { generatedAt: '2026-10-23T13:20:00Z', model: 'm', bestDay: 'd', bestResort: 'r', summary: 's', entries: [], ungrounded: [] };
    const caller = fakeCaller([good]);
    const res = await analyze(done, prevRanking, { caller, model: 'm', at: afternoon, mode: 'auto' });
    expect(res.calls).toHaveLength(0);
    expect(res.ranking).toBe(prevRanking);
  });
});

describe('usage', () => {
  it('prices Haiku 5.5 calls', () => {
    // 4000 in × $0.10 + 1000 cache read × $0.01 + 800 out × $0.50, per million
    expect(costUsd('claude-haiku-5-5', USAGE)).toBeCloseTo(0.00081, 6);
  });

  it('appends CSV rows and sums the month', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'powder-usage-')), 'usage.csv');
    const at = new Date('2026-11-02T13:20:00Z');
    const run = usageRun('claude-haiku-5-5', at, [{ label: 'a', usage: USAGE, stopReason: 'end_turn' }]);
    appendUsageCsv(path, run, 'auto', ['palisades']);
    appendUsageCsv(path, { ...run, at: '2026-10-30T13:20:00.000Z' }, 'auto', []);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines[0]).toMatch(/^timestamp,model/);
    expect(lines[1]).toMatch(/,palisades,4000,1000,0,800,0\.00081$/);
    expect(monthToDate(path, at)).toBeCloseTo(0.00081, 6);
  });
});
