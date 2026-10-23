import { describe, expect, it } from 'vitest';
import type { Ranking } from '../../shared/types';
import { bestFavorite, loadFavorites, matchesQuery, toggleFavorite } from '../../src/lib/favorites';

const resorts = [
  { id: 'palisades', defaultFavorite: true },
  { id: 'kirkwood', defaultFavorite: false },
  { id: 'mammoth', defaultFavorite: true },
  { id: 'mtbaldy', defaultFavorite: false },
];
const order = resorts.map((r) => r.id);

describe('loading saved favorites', () => {
  it('starts a new phone on the default resorts', () => {
    expect(loadFavorites(null, resorts)).toEqual({ ids: ['palisades', 'mammoth'], chosen: false });
  });

  it('falls back to the defaults when storage holds garbage', () => {
    for (const raw of ['x', '{}', '[1,2]', '"palisades"', 'null'])
      expect(loadFavorites(raw, resorts), raw).toEqual({ ids: ['palisades', 'mammoth'], chosen: false });
  });

  it('keeps known ids in resorts.json order and drops removed resorts', () => {
    expect(loadFavorites('["mtbaldy","gone","palisades"]', resorts)).toEqual({ ids: ['palisades', 'mtbaldy'], chosen: true });
  });

  it('keeps an empty list empty instead of bringing the defaults back', () => {
    expect(loadFavorites('[]', resorts)).toEqual({ ids: [], chosen: true });
  });
});

describe('starring', () => {
  it('adds and removes, keeping resorts.json order', () => {
    expect(toggleFavorite(['mammoth'], 'palisades', order)).toEqual(['palisades', 'mammoth']);
    expect(toggleFavorite(['palisades', 'mammoth'], 'palisades', order)).toEqual(['mammoth']);
  });

  it('ignores a resort that no longer exists', () => {
    expect(toggleFavorite(['mammoth'], 'gone', order)).toEqual(['mammoth']);
  });
});

describe('best bet among favorites', () => {
  const ranking: Ranking = {
    generatedAt: '2026-10-23T13:20:00Z',
    model: 'm',
    bestDay: '2026-10-24',
    bestResort: 'kirkwood',
    summary: 'Kirkwood wins.',
    entries: [
      { resortId: 'kirkwood', day: '2026-10-24', reason: 'a' },
      { resortId: 'mammoth', day: '2026-10-25', reason: 'b' },
      { resortId: 'palisades', day: '2026-10-24', reason: 'c' },
    ],
    ungrounded: [],
  };

  it('picks the highest-ranked favorite, not the overall winner', () => {
    expect(bestFavorite(ranking, ['palisades', 'mammoth'])).toEqual({ resortId: 'mammoth', day: '2026-10-25', reason: 'b' });
  });

  it('has nothing to show without a ranking or a ranked favorite', () => {
    expect(bestFavorite(null, ['palisades'])).toBeNull();
    expect(bestFavorite(ranking, ['mtbaldy'])).toBeNull();
    expect(bestFavorite(ranking, [])).toBeNull();
  });
});

describe('resort search', () => {
  it('ignores case and punctuation', () => {
    expect(matchesQuery('mt rose', 'Mt. Rose Ski Tahoe', 'Mt. Rose', 'Tahoe')).toBe(true);
    expect(matchesQuery('MT. ROSE', 'Mt. Rose Ski Tahoe')).toBe(true);
    expect(matchesQuery('sierra at', 'Sierra-at-Tahoe')).toBe(true);
  });

  it('matches word starts across name and region', () => {
    expect(matchesQuery('mam', 'Mammoth Mountain', 'Mammoth', 'Eastern Sierra')).toBe(true);
    expect(matchesQuery('tahoe pal', 'Palisades Tahoe', 'Palisades', 'Tahoe')).toBe(true);
    expect(matchesQuery('oth', 'Mammoth Mountain')).toBe(false);
    expect(matchesQuery('mam', 'Palisades Tahoe', 'Palisades', 'Tahoe')).toBe(false);
  });

  it('matches everything on an empty search', () => {
    expect(matchesQuery('  ', 'Anything')).toBe(true);
  });
});
