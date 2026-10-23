// NOAA Climate Prediction Center outlooks for a point.
// 6–10, 8–14, monthly and seasonal come from NOAA's ArcGIS map services (point query).
// Week 3–4 isn't on the map services, so it's read from CPC's published KML.

import type { CpcCat, CpcCategory, CpcData, CpcOutlook, EnsoStatus } from '../../shared/types';
import type { ResortConfig } from '../config';
import { fetchJson, fetchText, qs } from '../http';
import { decodeEntities, stripTags } from './text';

const MAP = 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks';
const WK34_KML = 'https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst';
export const ENSO_URL = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml';

interface ArcFeatures {
  features?: { attributes: Record<string, unknown> }[];
  error?: { message: string };
}

export function pointQueryUrl(service: string, layer: number, lat: number, lon: number): string {
  return `${MAP}/${service}/MapServer/${layer}/query?${qs({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  })}`;
}

export function normalizeCategory(raw: unknown): CpcCategory {
  const s = String(raw ?? '').toLowerCase();
  if (s.startsWith('above') || s === 'a') return 'above';
  if (s.startsWith('below') || s === 'b') return 'below';
  if (s.startsWith('normal') || s.startsWith('near') || s === 'n') return 'normal';
  return 'ec';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtRange(start: Date, end: Date): string {
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${fmtDate(start)}–${end.getUTCDate()}`
    : `${fmtDate(start)}–${fmtDate(end)}`;
}

interface PointResult {
  cat: CpcCat;
  valid: string | null;
}

/** Highest-probability polygon containing the point; no polygon means equal chances. */
export function parseArcPoint(json: ArcFeatures): PointResult {
  if (json.error) throw new Error(`CPC map service: ${json.error.message}`);
  const attrs = (json.features ?? []).map((f) => f.attributes);
  if (attrs.length === 0) return { cat: { cat: 'ec', prob: null }, valid: null };
  const best = attrs.reduce((a, b) => (Number(b.prob ?? 0) > Number(a.prob ?? 0) ? b : a));
  const cat = normalizeCategory(best.cat);
  let valid: string | null = null;
  if (typeof best.valid_seas === 'string') valid = best.valid_seas;
  else if (typeof best.start_date === 'number' && typeof best.end_date === 'number')
    valid = fmtRange(new Date(best.start_date), new Date(best.end_date));
  return { cat: { cat, prob: cat === 'ec' ? null : Number(best.prob) || null }, valid };
}

async function arcPoint(service: string, layer: number, r: ResortConfig): Promise<PointResult> {
  return parseArcPoint(await fetchJson<ArcFeatures>(pointQueryUrl(service, layer, r.lat, r.lon)));
}

// --- Week 3–4 KML -----------------------------------------------------------

type Ring = [number, number][];

interface KmlPlacemark {
  category: CpcCategory;
  prob: number | null;
  start: string | null;
  end: string | null;
  polygons: { outer: Ring; holes: Ring[] }[];
}

function parseRing(coords: string): Ring {
  return coords
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [lon, lat] = tuple.split(',').map(Number);
      return [lon, lat] as [number, number];
    })
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

function cell(html: string, label: string): string | null {
  const m = html.match(new RegExp(`<td>${label}</td>\\s*<td>([^<]*)</td>`, 'i'));
  return m ? m[1].trim() : null;
}

export function parseKml(kml: string): KmlPlacemark[] {
  return kml
    .split('<Placemark')
    .slice(1)
    .map((pm) => {
      const polygons = [...pm.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)].map(([, poly]) => {
        const outer = poly.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
        const holes = [...poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((h) =>
          parseRing(h[1]),
        );
        return { outer: outer ? parseRing(outer[1]) : [], holes };
      });
      const prob = Number(cell(pm, 'Probability'));
      return {
        category: normalizeCategory(cell(pm, 'Category')),
        prob: Number.isFinite(prob) ? prob : null,
        start: cell(pm, 'Start Date'),
        end: cell(pm, 'End Date'),
        polygons,
      };
    });
}

/** Ray casting; [lon, lat] coordinates. */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function kmlPoint(placemarks: KmlPlacemark[], lat: number, lon: number): PointResult {
  const hits = placemarks.filter((p) =>
    p.polygons.some((poly) => pointInRing(lon, lat, poly.outer) && !poly.holes.some((h) => pointInRing(lon, lat, h))),
  );
  const valid = placemarks[0]?.start && placemarks[0]?.end ? usRange(placemarks[0].start, placemarks[0].end) : null;
  if (hits.length === 0) return { cat: { cat: 'ec', prob: null }, valid };
  const best = hits.reduce((a, b) => ((b.prob ?? 0) > (a.prob ?? 0) ? b : a));
  return { cat: { cat: best.category, prob: best.category === 'ec' ? null : best.prob }, valid };
}

/** "10/31/2026", "11/13/2026" → "Oct 31–Nov 13". */
function usRange(start: string, end: string): string | null {
  const parse = (s: string) => {
    const [m, d, y] = s.split('/').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const a = parse(start);
  const b = parse(end);
  return Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) ? null : fmtRange(a, b);
}

async function wk34(kind: 'temp' | 'prcp'): Promise<KmlPlacemark[]> {
  return parseKml(await fetchText(`${WK34_KML}/wk34${kind}_latest.kml`, { timeoutMs: 60_000 }));
}

// --- ENSO -------------------------------------------------------------------

export function parseEnso(html: string): EnsoStatus {
  const text = decodeEntities(stripTags(html)).replace(/\s+/g, ' ');
  const status = text.match(/ENSO Alert System Status:\s*(.+?)\s*Synopsis:/)?.[1]?.trim();
  const synopsis = text.match(/Synopsis:\s*(.+?\.)\s/)?.[1]?.trim();
  const issued = text.match(/issued by[^.]*?on\s+(\d{1,2} \w+ \d{4})/i)?.[1] ?? text.match(/(\d{1,2} \w+ \d{4})/)?.[1] ?? null;
  if (!status || !synopsis) throw new Error('ENSO discussion format changed');
  return { status, synopsis, issued };
}

export async function fetchEnso(): Promise<EnsoStatus> {
  return parseEnso(await fetchText(ENSO_URL));
}

/** Outside the US: CPC's outlooks don't reach, but ENSO is global. */
export async function fetchEnsoOnly(): Promise<CpcData> {
  return { outlooks: [], enso: await fetchEnso() };
}

// --- Assembly ---------------------------------------------------------------

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function fetchCpc(r: ResortConfig): Promise<CpcData> {
  const [t610, p610, t814, p814, tw34, pw34, tMon, pMon, ...seas] = await Promise.all([
    settle(arcPoint('cpc_6_10_day_outlk', 0, r)),
    settle(arcPoint('cpc_6_10_day_outlk', 1, r)),
    settle(arcPoint('cpc_8_14_day_outlk', 0, r)),
    settle(arcPoint('cpc_8_14_day_outlk', 1, r)),
    settle(wk34('temp').then((pm) => kmlPoint(pm, r.lat, r.lon))),
    settle(wk34('prcp').then((pm) => kmlPoint(pm, r.lat, r.lon))),
    settle(arcPoint('cpc_mthly_temp_outlk', 0, r)),
    settle(arcPoint('cpc_mthly_precip_outlk', 0, r)),
    settle(arcPoint('cpc_sea_temp_outlk', 0, r)),
    settle(arcPoint('cpc_sea_precip_outlk', 0, r)),
    settle(arcPoint('cpc_sea_temp_outlk', 1, r)),
    settle(arcPoint('cpc_sea_precip_outlk', 1, r)),
    settle(arcPoint('cpc_sea_temp_outlk', 2, r)),
    settle(arcPoint('cpc_sea_precip_outlk', 2, r)),
  ]);

  const outlook = (
    key: CpcOutlook['key'],
    label: string,
    t: PointResult | null,
    p: PointResult | null,
    lowConfidence: boolean,
  ): CpcOutlook => ({ key, label, valid: t?.valid ?? p?.valid ?? null, temp: t?.cat ?? null, precip: p?.cat ?? null, lowConfidence });

  const outlooks = [
    outlook('6-10', '6–10 day', t610, p610, false),
    outlook('8-14', '8–14 day', t814, p814, false),
    outlook('wk34', 'Weeks 3–4', tw34, pw34, true),
    outlook('month', 'Next month', tMon, pMon, true),
    outlook('season1', 'Season', seas[0], seas[1], true),
    outlook('season2', 'Season', seas[2], seas[3], true),
    outlook('season3', 'Season', seas[4], seas[5], true),
  ];

  if (outlooks.every((o) => !o.temp && !o.precip)) throw new Error('all CPC outlook queries failed');
  return { outlooks, enso: await settle(fetchEnso()) };
}
