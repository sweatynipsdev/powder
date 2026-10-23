// Avalanche danger for Canadian resorts from Avalanche Canada's public API (keyless,
// documented at avalanche.ca/api-docs), looked up by point. Their terms say content may not
// be reproduced, so the app shows only the ratings and a link; the text goes to the writer.
// Daily forecasts start in late November; before that there's one province-wide product
// with "early season" ratings.

import type { AvalancheDanger, AvalancheData } from '../../shared/types';
import type { ResortConfig } from '../config';
import { fetchJson } from '../http';
import { DANGER_TEXT } from './avalanche';
import { htmlToText, truncate } from './text';

export const avcanPointUrl = (lat: number, lon: number) => `https://api.avalanche.ca/forecasts/en/products/point?lat=${lat.toFixed(4)}&long=${lon.toFixed(4)}`;

const LEVEL: Record<string, number> = { low: 1, moderate: 2, considerable: 3, high: 4, extreme: 5 };

type Rating = { rating?: { value?: string } };
interface AvcanProduct {
  url?: string;
  type?: string;
  report?: {
    title?: string;
    dateIssued?: string;
    validUntil?: string;
    highlights?: string | null;
    summaries?: { content?: string | null }[];
    dangerRatings?: { ratings?: { alp?: Rating; tln?: Rating; btl?: Rating } }[];
    problems?: { type?: { display?: string; value?: string } | string }[];
  };
}

/** "early season", "no rating" and anything unrecognized are 0 (no rating), never a guess. */
const level = (r: Rating | undefined) => LEVEL[r?.rating?.value?.toLowerCase() ?? ''] ?? 0;

function day(d: NonNullable<AvcanProduct['report']>['dangerRatings'], i: number): AvalancheDanger | null {
  const r = d?.[i]?.ratings;
  return r ? { upper: level(r.alp), middle: level(r.tln), lower: level(r.btl) } : null;
}

export function parseAvcan(json: unknown): AvalancheData {
  const p = json as AvcanProduct;
  const rep = p?.report;
  if (!rep || typeof rep !== 'object') throw new Error('unexpected Avalanche Canada response');
  const current = day(rep.dangerRatings, 0);
  const overall = current ? Math.max(current.upper, current.middle, current.lower) : -1;
  const summaries = (rep.summaries ?? []).map((s) => (s.content ? htmlToText(s.content) : '')).filter(Boolean);
  return {
    center: 'Avalanche Canada',
    // Off-season the one product's title lists every region in BC.
    zoneName: rep.title && rep.title.length <= 60 ? rep.title : 'Province-wide',
    url: p.url ?? 'https://avalanche.ca/',
    productType: p.type ?? 'unknown',
    publishedAt: rep.dateIssued ?? null,
    expiresAt: rep.validUntil ?? null,
    current,
    tomorrow: day(rep.dangerRatings, 1),
    overall,
    overallText: overall >= 0 ? DANGER_TEXT[overall] : 'No rating yet',
    bottomLine: rep.highlights ? truncate(htmlToText(rep.highlights), 900) : null,
    discussion: summaries.length ? truncate(summaries.join('\n\n'), 1500) : null,
    problems: (rep.problems ?? []).map((x) => (typeof x.type === 'string' ? x.type : (x.type?.display ?? x.type?.value ?? ''))).filter(Boolean),
    publicText: false,
  };
}

export async function fetchAvcan(r: ResortConfig): Promise<AvalancheData> {
  const at = r.summit ?? r;
  return parseAvcan(await fetchJson(avcanPointUrl(at.lat, at.lon)));
}
