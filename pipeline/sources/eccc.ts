// Weather alerts for Canadian resorts from Environment and Climate Change Canada (MSC GeoMet
// OGC API, keyless), under the ECCC Data Services End-use Licence: alerts are reproduced
// without altering their content, and ECCC is credited where they're shown.

import type { Alert } from '../../shared/types';
import { now } from '../clock';
import type { ResortConfig } from '../config';
import { fetchJson } from '../http';
import { pointInRing } from './cpc';

/** [south, west, north, east] → the API's bbox=west,south,east,north. */
export const ecccAlertsUrl = ([s, w, n, e]: [number, number, number, number]) =>
  `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=${w},${s},${e},${n}&limit=50`;

const warningsPage = (province: string | null) =>
  province ? `https://weather.gc.ca/warnings/index_e.html?prov=${province.toLowerCase()}` : 'https://weather.gc.ca/warnings/index_e.html';

const WINTER = /snowfall|winter storm|blizzard|snow squall|freezing (?:rain|drizzle)|extreme cold|wind chill|arctic outflow|\bwind\b/i;
const OVER = /^(?:ended|cancell?ed|expired)$/i;

type Ring = [number, number][];
interface Feature {
  id: string;
  properties: Record<string, string | null>;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Whether the alert's forecast zone holds the point; true when the zone has no geometry. */
function zoneHolds(f: Feature, lat: number, lon: number): boolean {
  const g = f.geometry;
  if (!g) return true;
  const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null) as Ring[][] | null;
  return polygons ? polygons.some((rings) => pointInRing(lon, lat, rings[0])) : true;
}

/**
 * Active alerts whose forecast zone holds the resort. The box query also returns alerts for
 * neighbouring zones (Howe Sound next to Whistler), and one feature per zone an alert covers.
 */
export function parseEcccAlerts(json: unknown, at: Date, point: { lat: number; lon: number }): Alert[] {
  const { features, numberMatched } = json as { features?: Feature[]; numberMatched?: number };
  if (!Array.isArray(features)) throw new Error('ECCC alerts: no features in the response');
  // A resort's box touches a few forecast zones, so one page of 50 holds them all; never
  // show a silently cut-off list.
  if (typeof numberMatched === 'number' && numberMatched > features.length) throw new Error(`ECCC alerts: ${numberMatched} matched but only ${features.length} returned`);
  const seen = new Set<string>();
  const alerts: Alert[] = [];
  for (const f of features) {
    const p = f.properties;
    const expires = p.expiration_datetime ? Date.parse(p.expiration_datetime) : Infinity;
    if (OVER.test(p.status_en ?? '') || expires < at.getTime() || !zoneHolds(f, point.lat, point.lon)) continue;
    // The id before "_" is the alert itself; the part after is the zone.
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
      url: warningsPage(p.province),
      winter: WINTER.test(`${p.alert_short_name_en ?? ''} ${event}`),
      source: 'ECCC',
    });
  }
  return alerts;
}

export async function fetchEcccAlerts(r: ResortConfig): Promise<Alert[]> {
  if (!r.eccc) throw new Error('no ECCC alert box configured');
  return parseEcccAlerts(await fetchJson(ecccAlertsUrl(r.eccc.bbox)), now(), r);
}
