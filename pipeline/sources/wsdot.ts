// WSDOT mountain pass reports (keyless ArcGIS layer on WSDOT's public GIS server): the
// restriction for each direction over a pass, plus the road and weather report text.
// Reports run November 1 to April 1; off-season the restrictions read "No restrictions".

import type { RoadSegment, RoadStatus } from '../../shared/types';
import { localIso } from '../clock';
import type { WsdotSegmentConfig } from '../config';
import { fetchJson } from '../http';
import { SEVERITY, worse } from './roadStatus';

export const WSDOT_PASSES_URL =
  'https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoMtPassReports/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json';

export interface WsdotPass {
  name: string;
  roadCondition: string;
  weather: string;
  /** Local Pacific time "YYYY-MM-DDTHH:MM", like Caltrans's. */
  displayDate: string | null;
  directions: { direction: string; message: string }[];
}

interface Feature {
  attributes: Record<string, string | number | null>;
}

const text = (v: string | number | null | undefined) => (typeof v === 'string' ? v.trim() : '');

export function parseWsdot(json: unknown): WsdotPass[] {
  const features = (json as { features?: Feature[] }).features;
  if (!Array.isArray(features)) throw new Error('WSDOT pass reports: no features in the response');
  return features.map(({ attributes: a }) => ({
    name: text(a.PassName),
    roadCondition: text(a.RoadCondition),
    weather: text(a.Weather),
    displayDate: typeof a.DisplayDate === 'number' ? localIso(new Date(a.DisplayDate), 'America/Los_Angeles') : null,
    directions: [
      { direction: text(a.TravelDirection1), message: text(a.PublicMessage1) },
      { direction: text(a.TravelDirection2), message: text(a.PublicMessage2) },
    ].filter((d) => d.message),
  }));
}

/**
 * What a direction's restriction asks of a passenger car. The car-wide wording is checked
 * before "traction tires", so "chains required on vehicles towing" stays R-1 for a car.
 * Wording we haven't seen is unknown, never clear.
 */
export function wsdotStatus(message: string): RoadStatus | null {
  const m = message.trim().toLowerCase();
  if (!m) return null;
  if (/\bclosed\b/.test(m)) return 'closed';
  if (/chains? (?:are )?required on all vehicles except/.test(m)) return 'R-2';
  if (/chains? (?:are )?required on all vehicles/.test(m)) return 'R-3';
  if (/traction tires (?:are )?required/.test(m)) return 'R-1';
  if (/traction tires (?:are )?advised/.test(m)) return 'advisory';
  if (/^no restrictions\.?$/.test(m)) return 'clear';
  return 'unknown';
}

export function buildWsdotSegment(cfg: WsdotSegmentConfig, passes: WsdotPass[]): RoadSegment {
  const pass = passes.find((p) => p.name === cfg.pass);
  if (!pass) throw new Error(`WSDOT has no pass report named "${cfg.pass}"`);

  const rated = pass.directions.map((d) => ({ ...d, status: wsdotStatus(d.message) ?? 'unknown' }));
  const worst = rated.reduce<(typeof rated)[number] | null>((w, d) => (!w || SEVERITY.indexOf(d.status) > SEVERITY.indexOf(w.status) ? d : w), null);
  const status = rated.reduce<RoadStatus>((s, d) => worse(s, d.status), 'unknown');
  const directionsDiffer = new Set(rated.map((d) => d.status)).size > 1;

  return {
    label: cfg.label,
    route: cfg.route,
    status,
    restriction: worst ? (directionsDiffer && worst.direction ? `${worst.direction}: ${worst.message}` : worst.message) : null,
    stations: 0,
    worst: worst && { name: pass.name, status: worst.message, description: pass.roadCondition, since: pass.displayDate },
    closures: [],
    // Shown, never parsed for status: Mt. Baker's report says the road is closed above the
    // ski area all winter while the road to it is open.
    notes: [pass.roadCondition, pass.weather].filter(Boolean),
  };
}

export async function fetchWsdot(segments: WsdotSegmentConfig[]): Promise<RoadSegment[]> {
  const passes = parseWsdot(await fetchJson(WSDOT_PASSES_URL));
  return segments.map((s) => buildWsdotSegment(s, passes));
}
