// Token and cost accounting. Every run appends one line to logs/usage.csv.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { UsageRun } from '../shared/types';

export interface CallUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

/** USD per million tokens (prompts up to 100K tokens). Cache writes are 5-minute writes. */
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export function costUsd(model: string, u: CallUsage): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (
    (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1e6
  );
}

export function addUsage(a: CallUsage, b: CallUsage): CallUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

export const ZERO_USAGE: CallUsage = { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };

const HEADER = 'timestamp,model,mode,calls,regenerated,input_tokens,cache_read_tokens,cache_write_tokens,output_tokens,cost_usd';

export function appendUsageCsv(path: string, run: UsageRun, mode: string, regenerated: string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, HEADER + '\n');
  appendFileSync(
    path,
    [
      run.at,
      run.model,
      mode,
      run.calls,
      regenerated.join(';') || '-',
      run.inputTokens,
      run.cacheReadTokens,
      run.cacheWriteTokens,
      run.outputTokens,
      run.costUsd.toFixed(5),
    ].join(',') + '\n',
  );
}

/** Sum of cost_usd for rows in the same calendar month (UTC) as `at`. */
export function monthToDate(path: string, at: Date): number {
  if (!existsSync(path)) return 0;
  const month = at.toISOString().slice(0, 7);
  return readFileSync(path, 'utf8')
    .split('\n')
    .slice(1)
    .filter((line) => line.startsWith(month))
    .reduce((sum, line) => sum + (Number(line.split(',').at(-1)) || 0), 0);
}
