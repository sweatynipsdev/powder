// National Weather Service (api.weather.gov): point forecast, active alerts, and the
// Area Forecast Discussion (the forecasters' own write-up) for the resort's office.

import type { AfdData, Alert, NwsData } from '../../shared/types';
import type { ResortConfig } from '../config';
import { fetchJson } from '../http';
import { truncate } from './text';

const NWS = 'https://api.weather.gov';
const HEADERS = { Accept: 'application/geo+json' };

/** Alert types that matter for a ski day or the drive. */
const WINTER_EVENT = /winter|blizzard|snow|ice storm|freezing|avalanche|wind chill|extreme cold|high wind/i;

const AFD_MAX_CHARS = 3500;

export function pointsUrl(r: ResortConfig): string {
  return `${NWS}/points/${r.lat.toFixed(4)},${r.lon.toFixed(4)}`;
}

interface PointsResponse {
  properties: { forecast: string };
}

interface ForecastResponse {
  properties: {
    updateTime?: string;
    periods: {
      name: string;
      startTime: string;
      isDaytime: boolean;
      temperature: number | null;
      shortForecast: string;
      detailedForecast: string;
    }[];
  };
}

export function parseForecast(json: ForecastResponse, url: string): NwsData {
  const periods = json.properties?.periods;
  if (!Array.isArray(periods) || periods.length === 0) throw new Error('NWS forecast has no periods');
  return {
    updatedAt: json.properties.updateTime ?? null,
    url,
    periods: periods.slice(0, 8).map((p) => ({
      name: p.name,
      startTime: p.startTime,
      isDaytime: p.isDaytime,
      temperature: p.temperature ?? null,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
    })),
  };
}

export async function fetchNwsForecast(r: ResortConfig): Promise<NwsData> {
  const points = await fetchJson<PointsResponse>(pointsUrl(r), { headers: HEADERS });
  const url = points.properties.forecast;
  const page = `https://forecast.weather.gov/MapClick.php?lat=${r.lat}&lon=${r.lon}`;
  return parseForecast(await fetchJson<ForecastResponse>(url, { headers: HEADERS }), page);
}

interface AlertsResponse {
  features: {
    id: string;
    properties: {
      id: string;
      event: string;
      headline: string | null;
      severity: string;
      onset: string | null;
      ends: string | null;
      expires: string | null;
      description: string | null;
      '@id'?: string;
    };
  }[];
}

export function alertsUrl(r: ResortConfig): string {
  return `${NWS}/alerts/active?point=${r.lat.toFixed(4)},${r.lon.toFixed(4)}`;
}

export function parseAlerts(json: AlertsResponse): Alert[] {
  if (!Array.isArray(json.features)) throw new Error('NWS alerts response has no features');
  return json.features.map((f) => {
    const p = f.properties;
    return {
      id: p.id,
      event: p.event,
      headline: p.headline ?? p.event,
      severity: p.severity,
      onset: p.onset,
      ends: p.ends ?? p.expires,
      description: truncate((p.description ?? '').replace(/\s*\n\s*/g, ' ').trim(), 700),
      url: f.id,
      winter: WINTER_EVENT.test(p.event),
    };
  });
}

export async function fetchAlerts(r: ResortConfig): Promise<Alert[]> {
  return parseAlerts(await fetchJson<AlertsResponse>(alertsUrl(r), { headers: HEADERS }));
}

// --- Area Forecast Discussion -------------------------------------------------

/** Splits a raw AFD into its ".SECTION..." blocks. */
export function afdSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  const re = /^\.([A-Z][A-Z0-9 /\-]+?)\.\.\.(.*)$/gm;
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : text.length;
    const body = (m[2] + '\n' + text.slice(start, end)).split(/^&&\s*$/m)[0];
    sections.set(m[1].trim(), body);
  });
  return sections;
}

/** Joins hard-wrapped lines into paragraphs, keeping bullets and blank-line breaks. */
export function unwrap(block: string): string {
  return block
    .trim()
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split('\n')
        .map((l) => l.trim())
        .reduce((acc, line) => (line.startsWith('* ') || line.startsWith('- ') ? `${acc}\n${line}` : `${acc} ${line}`), '')
        .trim(),
    )
    .filter(Boolean)
    .join('\n\n');
}

export function parseAfd(office: string, productText: string, issuedAt: string, url: string): AfdData {
  const s = afdSections(productText);
  const pick = (...names: string[]) =>
    names
      .map((n) => [...s.entries()].find(([k]) => k.startsWith(n))?.[1])
      .filter((v): v is string => !!v)
      .map(unwrap)
      .join('\n\n') || null;
  const keyMessages = pick('KEY MESSAGES', 'SYNOPSIS');
  const discussion = pick('DISCUSSION', 'SHORT TERM', 'LONG TERM');
  if (!keyMessages && !discussion) throw new Error(`AFD from ${office} has no recognizable sections`);
  return {
    office,
    issuedAt,
    url,
    keyMessages: keyMessages && truncate(keyMessages, 1500),
    discussion: discussion && truncate(discussion, AFD_MAX_CHARS),
  };
}

interface ProductList {
  '@graph': { '@id': string; issuanceTime: string }[];
}

export async function fetchAfd(office: string): Promise<AfdData> {
  const list = await fetchJson<ProductList>(`${NWS}/products/types/AFD/locations/${office}`, { headers: HEADERS });
  const latest = list['@graph']?.[0];
  if (!latest) throw new Error(`no AFD products for ${office}`);
  const product = await fetchJson<{ productText: string }>(latest['@id'], { headers: HEADERS });
  const page = `https://forecast.weather.gov/product.php?site=${office}&issuedby=${office}&product=AFD`;
  return parseAfd(office, product.productText, latest.issuanceTime, page);
}
