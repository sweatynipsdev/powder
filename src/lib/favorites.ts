// Which resorts a phone follows. Pure rules here (tested); the reactive state that saves to
// localStorage is in favorites.svelte.ts.

import type { Ranking, RankingEntry } from '../../shared/types';

export interface Favorites {
  ids: string[];
  /** False while the phone is still on the default resorts (nothing saved yet). */
  chosen: boolean;
}

/** A saved list in resorts.json order with removed resorts dropped; the defaults if nothing valid is saved. */
export function loadFavorites(raw: string | null, resorts: { id: string; defaultFavorite: boolean }[]): Favorites {
  const defaults = { ids: resorts.filter((r) => r.defaultFavorite).map((r) => r.id), chosen: false };
  if (raw === null) return defaults;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!Array.isArray(saved) || !saved.every((x) => typeof x === 'string')) return defaults;
  const set = new Set(saved);
  return { ids: resorts.map((r) => r.id).filter((id) => set.has(id)), chosen: true };
}

export function toggleFavorite(ids: string[], id: string, order: string[]): string[] {
  const set = new Set(ids);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return order.filter((x) => set.has(x));
}

/** The AI ranks every resort; the best bet is the highest-ranked one this phone follows. */
export function bestFavorite(ranking: Ranking | null, ids: string[]): RankingEntry | null {
  return ranking?.entries.find((e) => ids.includes(e.resortId)) ?? null;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** Every word typed starts some word of the fields: "mt rose" finds "Mt. Rose". */
export function matchesQuery(q: string, ...fields: string[]): boolean {
  const have = fields.flatMap(words);
  return words(q).every((w) => have.some((h) => h.startsWith(w)));
}
