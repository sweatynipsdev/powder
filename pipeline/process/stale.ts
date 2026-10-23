// Per-source isolation: a failed fetch never fails the run. If an earlier run had data
// for that source, it's carried forward and marked stale.

import type { Sourced } from '../../shared/types';

export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

export async function attempt<T>(fn: () => Promise<T>, at: Date): Promise<Sourced<T>> {
  try {
    return { status: { ok: true, stale: false, fetchedAt: at.toISOString() }, data: await fn() };
  } catch (e) {
    return { status: { ok: false, stale: false, fetchedAt: null, error: errorMessage(e) }, data: null };
  }
}

export function carryForward<T>(current: Sourced<T>, previous: Sourced<T> | null | undefined): Sourced<T> {
  if (current.status.ok || !previous?.data) return current;
  return {
    status: { ok: false, stale: true, fetchedAt: previous.status.fetchedAt, error: current.status.error },
    data: previous.data,
  };
}
