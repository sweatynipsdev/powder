// Writes the daily analysis into the JSON the pipeline produced.
//
//   npm run analyze             morning runs rewrite every resort; afternoon runs only
//                               rewrite resorts whose forecast materially changed
//   npm run analyze -- --force  rewrite everything
//   npm run analyze:sample      --force, plus samples/analysis-sample.md for review
//
// Env: ANTHROPIC_API_KEY (from .env locally, Actions secret in CI), POWDER_MODEL
// (default claude-haiku-5-5), POWDER_EFFORT (low|medium|high), POWDER_OUT_DIR.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { localIso } from '../pipeline/clock';
import { DEFAULT_OUT_DIR } from '../pipeline/run';
import type { DataIndex, Ranking, ResortAnalysis, ResortData, UsageRun } from '../shared/types';
import { buildBrief, buildRankingBrief } from './brief';
import { fingerprint } from './fingerprint';
import { findUngrounded, metaReferences, tidyAmounts } from './grounding';
import { RANKING_SYSTEM, rankingUserMessage, RESORT_SYSTEM, resortUserMessage, retryNote } from './prompt';
import { rankingSchema, resortAnalysisSchema, type ResortAnalysisOutput } from './schema';
import { addUsage, appendUsageCsv, type CallUsage, costUsd, monthToDate, ZERO_USAGE } from './usage';
import { anthropicCaller, type Caller, type Effort } from './writer';

export const DEFAULT_MODEL = 'claude-haiku-5-5';
export const DEFAULT_EFFORT: Effort = 'medium';
/** An afternoon run rewrites anyway if the last write-up is older than this. */
export const MAX_AGE_HOURS = 20;
const MAX_TOKENS = 8000;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const USAGE_CSV = join(ROOT, 'logs', 'usage.csv');

export type Mode = 'auto' | 'force';

export function needsRewrite(r: ResortData, mode: Mode, at: Date): { rewrite: boolean; reason: string } {
  if (!r.forecast.data) return { rewrite: false, reason: 'no forecast data' };
  if (mode === 'force') return { rewrite: true, reason: 'forced' };
  if (!r.analysis) return { rewrite: true, reason: 'no analysis yet' };
  const hour = Number(localIso(at, r.tz).slice(11, 13));
  if (hour < 12) return { rewrite: true, reason: 'morning run' };
  if ((at.getTime() - Date.parse(r.analysis.generatedAt)) / 3_600_000 > MAX_AGE_HOURS) return { rewrite: true, reason: 'analysis is old' };
  if (r.analysis.fingerprint !== fingerprint(r)) return { rewrite: true, reason: 'forecast changed' };
  return { rewrite: false, reason: 'unchanged' };
}

const analysisTexts = (a: ResortAnalysisOutput) => [a.headline, a.summary, a.next5Days, a.extended6to16, a.modelAgreement.summary, a.whatToWatch];

export interface CallLog {
  label: string;
  usage: CallUsage;
  stopReason: string | null;
}

export interface AnalyzeResult {
  resorts: ResortData[];
  ranking: Ranking | null;
  regenerated: string[];
  skipped: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
  calls: CallLog[];
}

/** Applies `f` to every string in a parsed output, keeping its shape. */
function mapStrings<T>(v: T, f: (s: string) => string): T {
  if (typeof v === 'string') return f(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, f)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)])) as T;
  return v;
}

/**
 * One write-up call with the number and style checks. A draft that fails gets one retry
 * naming the problems; if the retry still fails it's published with `ungrounded` set.
 */
async function checkedCall<S extends z.ZodType>(
  req: { label: string; system: string; user: string; schema: S; brief: string; texts: (p: z.infer<S>) => string[] },
  caller: Caller,
  calls: CallLog[],
): Promise<{ parsed: z.infer<S>; ungrounded: string[] }> {
  let user = req.user;
  for (let attempt = 1; ; attempt++) {
    const res = await caller({ system: req.system, user, schema: req.schema, maxTokens: MAX_TOKENS });
    calls.push({ label: `${req.label}#${attempt}`, usage: res.usage, stopReason: res.stopReason });
    if (res.stopReason === 'refusal') throw new Error('model declined the request');
    if (!res.parsed) throw new Error(`no parsable output (stop_reason ${res.stopReason})`);
    const parsed = mapStrings(res.parsed, tidyAmounts);
    const texts = req.texts(parsed);
    const ungrounded = findUngrounded(texts, req.brief);
    const meta = metaReferences(texts);
    if ((ungrounded.length === 0 && meta.length === 0) || attempt === 2) return { parsed, ungrounded };
    user = req.user + retryNote(ungrounded, meta);
  }
}

async function writeResort(r: ResortData, caller: Caller, model: string, at: Date, calls: CallLog[]): Promise<ResortAnalysis> {
  const brief = buildBrief(r, at);
  const { parsed, ungrounded } = await checkedCall(
    { label: r.id, system: RESORT_SYSTEM, user: resortUserMessage(brief.json), schema: resortAnalysisSchema, brief: brief.json, texts: analysisTexts },
    caller,
    calls,
  );
  return { generatedAt: at.toISOString(), model, ...parsed, ungrounded, fingerprint: fingerprint(r) };
}

async function writeRanking(resorts: ResortData[], caller: Caller, model: string, at: Date, calls: CallLog[]): Promise<Ranking | null> {
  const withForecast = resorts.filter((r) => r.forecast.data);
  if (withForecast.length === 0) return null;
  const ids = withForecast.map((r) => r.id) as [string, ...string[]];
  const dates = withForecast[0].forecast.data!.days.slice(0, 7).map((d) => d.date) as [string, ...string[]];
  const brief = buildRankingBrief(withForecast, at);
  const { parsed: p, ungrounded } = await checkedCall(
    {
      label: 'ranking',
      system: RANKING_SYSTEM,
      user: rankingUserMessage(brief),
      schema: rankingSchema(ids, dates),
      brief,
      texts: (out) => [out.summary, ...out.ranking.map((e) => e.reason)],
    },
    caller,
    calls,
  );
  return {
    generatedAt: at.toISOString(),
    model,
    bestDay: p.bestDay,
    bestResort: p.bestResort,
    summary: p.summary,
    entries: p.ranking.map((e) => ({ resortId: e.resortId, day: e.day, reason: e.reason })),
    ungrounded,
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function analyze(
  resorts: ResortData[],
  previousRanking: Ranking | null,
  opts: { caller: Caller; model: string; at: Date; mode: Mode },
): Promise<AnalyzeResult> {
  const { caller, model, at, mode } = opts;
  const calls: CallLog[] = [];
  const regenerated: string[] = [];
  const skipped: AnalyzeResult['skipped'] = [];
  const failed: AnalyzeResult['failed'] = [];

  // Sequential on purpose: the first call writes the system-prompt cache the rest read.
  const out: ResortData[] = [];
  for (const r of resorts) {
    const { rewrite, reason } = needsRewrite(r, mode, at);
    if (!rewrite) {
      skipped.push({ id: r.id, reason });
      out.push(r);
      continue;
    }
    try {
      out.push({ ...r, analysis: await writeResort(r, caller, model, at, calls) });
      regenerated.push(r.id);
    } catch (e) {
      // Keep yesterday's write-up rather than showing nothing.
      failed.push({ id: r.id, error: message(e) });
      out.push(r);
    }
  }

  let ranking = previousRanking;
  const rankingOld = !ranking || (at.getTime() - Date.parse(ranking.generatedAt)) / 3_600_000 > MAX_AGE_HOURS;
  if (regenerated.length > 0 || rankingOld) {
    try {
      ranking = (await writeRanking(out, caller, model, at, calls)) ?? ranking;
    } catch (e) {
      failed.push({ id: 'ranking', error: message(e) });
    }
  }

  return { resorts: out, ranking, regenerated, skipped, failed, calls };
}

export function usageRun(model: string, at: Date, calls: CallLog[]): UsageRun {
  const total = calls.reduce((a, c) => addUsage(a, c.usage), ZERO_USAGE);
  return { at: at.toISOString(), model, calls: calls.length, ...total, costUsd: costUsd(model, total) };
}

// --- CLI -----------------------------------------------------------------------

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function sampleMarkdown(result: AnalyzeResult, run: UsageRun, effort: Effort): string {
  const lines = [
    '# Powder analysis sample',
    '',
    `Generated ${run.at} with \`${run.model}\` (effort \`${effort}\`). ${run.calls} API calls, ${run.inputTokens} input + ${run.cacheReadTokens} cache-read + ${run.cacheWriteTokens} cache-write + ${run.outputTokens} output tokens = **$${run.costUsd.toFixed(4)}**.`,
    '',
    'The prompts are in `analysis/prompt.ts`; each resort is written from the brief built in `analysis/brief.ts`.',
    '',
  ];
  if (result.ranking) {
    const rk = result.ranking;
    lines.push('## Best day / best resort', '', `**${rk.bestResort} on ${rk.bestDay}.** ${rk.summary}`, '');
    for (const e of rk.entries) lines.push(`${rk.entries.indexOf(e) + 1}. **${e.resortId}** (${e.day}): ${e.reason}`);
    if (rk.ungrounded.length) lines.push('', `⚠ Ungrounded numbers: ${rk.ungrounded.join(', ')}`);
    lines.push('');
  }
  for (const r of result.resorts) {
    const a = r.analysis;
    lines.push(`## ${r.name}`, '');
    if (!a) {
      lines.push('_No analysis._', '');
      continue;
    }
    lines.push(
      `### ${a.headline}`,
      '',
      ...(a.summary ? [`_${a.summary}_`, ''] : []),
      '**Next 5 days**',
      '',
      a.next5Days,
      '',
      '**Days 6–16**',
      '',
      a.extended6to16,
      '',
      `**Model agreement** (confidence: ${a.modelAgreement.confidence})`,
      '',
      a.modelAgreement.summary,
      '',
      `**What to watch:** ${a.whatToWatch}`,
      '',
    );
    if (a.ungrounded.length) lines.push(`⚠ Ungrounded numbers after retry: ${a.ungrounded.join(', ')}`, '');
  }
  lines.push('## Calls', '', '| call | input | cache read | cache write | output | stop |', '|---|---|---|---|---|---|');
  for (const c of result.calls)
    lines.push(`| ${c.label} | ${c.usage.inputTokens} | ${c.usage.cacheReadTokens} | ${c.usage.cacheWriteTokens} | ${c.usage.outputTokens} | ${c.stopReason} |`);
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
  const args = new Set(process.argv.slice(2));
  const sample = args.has('--sample');
  const mode: Mode = args.has('--force') || sample ? 'force' : 'auto';
  const model = process.env.POWDER_MODEL || DEFAULT_MODEL;
  const effort = (process.env.POWDER_EFFORT as Effort) || DEFAULT_EFFORT;
  const dir = process.env.POWDER_OUT_DIR || DEFAULT_OUT_DIR;
  const at = new Date();

  const index = readJson<DataIndex>(join(dir, 'data.json'));
  const resorts = index.resorts.map((s) => readJson<ResortData>(join(dir, 'resorts', `${s.id}.json`)));

  if (!process.env.ANTHROPIC_API_KEY) {
    const msg = 'ANTHROPIC_API_KEY is not set; keeping the previous analysis.';
    console.warn(msg);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Analysis\n\n⚠ ${msg}\n`);
    return;
  }

  const result = await analyze(resorts, index.ranking, { caller: anthropicCaller(model, effort), model, at, mode });
  const run = usageRun(model, at, result.calls);
  appendUsageCsv(USAGE_CSV, run, mode, result.regenerated);

  for (const r of result.resorts) writeFileSync(join(dir, 'resorts', `${r.id}.json`), JSON.stringify(r));
  const byId = new Map(result.resorts.map((r) => [r.id, r]));
  const nextIndex: DataIndex = {
    ...index,
    resorts: index.resorts.map((s) => ({ ...s, headline: byId.get(s.id)?.analysis?.headline ?? s.headline })),
    ranking: result.ranking,
    usage: { lastRun: run, monthToDateUsd: monthToDate(USAGE_CSV, at) },
  };
  writeFileSync(join(dir, 'data.json'), JSON.stringify(nextIndex));

  const report = [
    `Analysis (${mode}, ${model}, effort ${effort}): rewrote ${result.regenerated.join(', ') || 'nothing'}`,
    ...result.skipped.map((s) => `  skipped ${s.id}: ${s.reason}`),
    ...result.failed.map((f) => `  FAILED ${f.id}: ${f.error}`),
    `  ${run.calls} calls, ${run.inputTokens} in / ${run.cacheReadTokens} cache read / ${run.cacheWriteTokens} cache write / ${run.outputTokens} out, $${run.costUsd.toFixed(4)}`,
    ...result.resorts.filter((r) => r.analysis?.ungrounded.length).map((r) => `  ⚠ ${r.id} ungrounded: ${r.analysis!.ungrounded.join(', ')}`),
  ].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Analysis\n\n\`\`\`\n${report}\n\`\`\`\n`);

  if (sample) {
    const path = join(ROOT, 'samples', 'analysis-sample.md');
    mkdirSync(join(ROOT, 'samples'), { recursive: true });
    writeFileSync(path, sampleMarkdown(result, run, effort));
    console.log(`Wrote ${path}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
