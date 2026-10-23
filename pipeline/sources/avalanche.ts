// Avalanche danger from the avalanche.org public API (no key).
// Early and late season the centers publish "summary" products with no danger ratings.

import type { AvalancheDanger, AvalancheData } from '../../shared/types';
import type { ResortConfig } from '../config';
import { fetchJson, qs } from '../http';
import { htmlToText, truncate } from './text';

export const DANGER_TEXT = ['No rating', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'];

interface ProductResponse {
  product_type?: string;
  published_time?: string | null;
  expires_time?: string | null;
  bottom_line?: string | null;
  hazard_discussion?: string | null;
  weather_discussion?: string | null;
  danger?: { lower: number | null; middle: number | null; upper: number | null; valid_day: string }[];
  forecast_avalanche_problems?: { name: string }[] | null;
  forecast_zone?: { id: number; name: string; url: string | null }[];
}

export function avalancheUrl(center: string, zoneId: number): string {
  return `https://api.avalanche.org/v2/public/product?${qs({ type: 'forecast', center_id: center, zone_id: zoneId })}`;
}

function danger(d: ProductResponse['danger'], day: string): AvalancheDanger | null {
  const row = d?.find((x) => x.valid_day === day);
  if (!row) return null;
  const n = (v: number | null) => (typeof v === 'number' ? v : -1);
  return { upper: n(row.upper), middle: n(row.middle), lower: n(row.lower) };
}

/** The forecasters' weather and hazard write-ups: local observations the models don't have. */
function discussionText(json: ProductResponse): string | null {
  const parts = [json.weather_discussion, json.hazard_discussion]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map(htmlToText)
    .filter(Boolean);
  return parts.length ? truncate(parts.join('\n\n'), 1500) : null;
}

export function parseAvalanche(center: string, zoneId: number, json: ProductResponse): AvalancheData {
  if (!json || typeof json !== 'object' || !('product_type' in json)) throw new Error('unexpected avalanche.org response');
  const zone = json.forecast_zone?.find((z) => z.id === zoneId) ?? json.forecast_zone?.[0];
  const current = danger(json.danger, 'current');
  const overall = current ? Math.max(current.upper, current.middle, current.lower) : -1;
  return {
    center,
    zoneName: zone?.name ?? center,
    url: zone?.url ?? `https://avalanche.org/`,
    productType: json.product_type ?? 'unknown',
    publishedAt: json.published_time ?? null,
    expiresAt: json.expires_time ?? null,
    current,
    tomorrow: danger(json.danger, 'tomorrow'),
    overall,
    overallText: overall >= 0 ? DANGER_TEXT[overall] : 'No rating yet',
    bottomLine: json.bottom_line ? truncate(htmlToText(json.bottom_line), 900) : null,
    discussion: discussionText(json),
    problems: (json.forecast_avalanche_problems ?? []).map((p) => p.name),
    publicText: true,
  };
}

export async function fetchAvalanche(r: ResortConfig): Promise<AvalancheData> {
  const a = r.avalanche;
  if (!a || !('center' in a)) throw new Error('no avalanche.org center configured');
  return parseAvalanche(a.center, a.zoneId, await fetchJson<ProductResponse>(avalancheUrl(a.center, a.zoneId)));
}
