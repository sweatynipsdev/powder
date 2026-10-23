// Weather alerts for Canadian resorts from Environment and Climate Change Canada (MSC GeoMet
// OGC API, keyless), under the ECCC Data Services End-use Licence: alerts are reproduced
// without altering their content, and ECCC is credited where they're shown.

import type { Alert } from '../../shared/types';
import { now } from '../clock';
import type { ResortConfig } from '../config';
import { fetchJson } from '../http';

/** [south, west, north, east] → the API's bbox=west,south,east,north. */
export const ecccAlertsUrl = ([s, w, n, e]: [number, number, number, number]) =>
  `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=${w},${s},${e},${n}&limit=50`;

const WARNINGS_PAGE = 'https://weather.gc.ca/warnings/index_e.html?prov=bc';

const WINTER = /snowfall|winter storm|blizzard|snow squall|freezing (?:rain|drizzle)|extreme cold|wind chill|arctic outflow|\bwind\b/i;

interface Feature {
  id: string;
  properties: Record<string, string | null>;
}

export function parseEcccAlerts(json: unknown, now: Date): Alert[] {
  const features = (json as { features?: Feature[] }).features;
  if (!Array.isArray(features)) throw new Error('ECCC alerts: no features in the response');
  const seen = new Set<string>();
  const alerts: Alert[] = [];
  for (const f of features) {
    const p = f.properties;
    const expires = p.expiration_datetime ? Date.parse(p.expiration_datetime) : Infinity;
    if (p.status_en === 'ended' || expires < now.getTime()) continue;
    // One feature per forecast zone the alert covers; the id before "_" is the alert itself.
    const id = f.id.split('_')[0];
    if (seen.has(id)) continue;
    seen.add(id);
    const event = p.alert_name_en ?? 'weather alert';
    alerts.push({
      id,
      event,
      headline: p.feature_name_en ? `${event} · ${p.feature_name_en}` : event,
      severity: p.risk_colour_en ?? p.alert_type ?? 'unknown',
      onset: p.validity_datetime,
      ends: p.event_end_datetime ?? p.expiration_datetime,
      description: p.alert_text_en ?? '',
      url: WARNINGS_PAGE,
      winter: WINTER.test(`${p.alert_short_name_en ?? ''} ${event}`),
      source: 'ECCC',
    });
  }
  return alerts;
}

export async function fetchEcccAlerts(r: ResortConfig): Promise<Alert[]> {
  if (!r.eccc) throw new Error('no ECCC alert box configured');
  return parseEcccAlerts(await fetchJson(ecccAlertsUrl(r.eccc.bbox)), now());
}
