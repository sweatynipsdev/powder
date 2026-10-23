// The one place that talks to the Claude API. Everything else goes through `Caller`,
// so tests can substitute a fake.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { CallUsage } from './usage';

export type Effort = 'low' | 'medium' | 'high';

export interface CallRequest<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
}

export interface CallResult<T> {
  parsed: T | null;
  stopReason: string | null;
  usage: CallUsage;
}

export type Caller = <S extends z.ZodType>(req: CallRequest<S>) => Promise<CallResult<z.infer<S>>>;

export function anthropicCaller(model: string, effort: Effort, client: Anthropic = new Anthropic()): Caller {
  return async (req) => {
    const res = await client.messages.parse({
      model,
      max_tokens: req.maxTokens,
      // Static system prompt, cached across the resorts in one run.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.user }],
      output_config: { effort, format: zodOutputFormat(req.schema) },
    });
    return {
      parsed: (res.parsed_output ?? null) as never,
      stopReason: res.stop_reason,
      usage: {
        inputTokens: res.usage.input_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
        outputTokens: res.usage.output_tokens,
      },
    };
  };
}
