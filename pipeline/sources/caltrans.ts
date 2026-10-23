// Caltrans road conditions for the drive: chain controls (CWWP2 cc feed), full mainline
// closures (CWWP2 lcs feed) and the highway-conditions text from roads.dot.ca.gov.

import type { RoadSegment, RoadStatus } from '../../shared/types';
import type { CaltransSegmentConfig } from '../config';
import { now } from '../clock';
import { fetchJson, fetchText } from '../http';
import { SEVERITY } from './roadStatus';
import { decodeEntities } from './text';

const CWWP2 = 'https://cwwp2.dot.ca.gov/data';
const dd = (d: number) => String(d).padStart(2, '0');

export const ccUrl = (district: number) => `${CWWP2}/d${district}/cc/ccStatusD${dd(district)}.json`;
export const lcsUrl = (district: number) => `${CWWP2}/d${district}/lcs/lcsStatusD${dd(district)}.json`;
export const roadsTextUrl = (numbers: string[]) => `https://roads.dot.ca.gov/roadscell.php?roadnumber=${numbers.join(',')}`;

/** Show closures that start within this many hours. */
const UPCOMING_CLOSURE_HOURS = 12;

export function normalizeChainStatus(status: string, description = ''): RoadStatus {
  const s = `${status} ${description}`.toUpperCase();
  if (s.includes('CLOSED')) return 'closed';
  const m = status.toUpperCase().match(/R-?([0-3])/);
  if (!m) return 'unknown';
  return m[1] === '0' ? 'clear' : (`R-${m[1]}` as RoadStatus);
}

function inBox(lat: number, lon: number, [s, w, n, e]: CaltransSegmentConfig['bbox']): boolean {
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

// --- chain controls ----------------------------------------------------------

interface CcFeed {
  data: {
    cc: {
      inService: string;
      location: { locationName: string; latitude: string; longitude: string; route: string; direction: string };
      statusData: {
        status: string;
        statusDescription: string;
        statusTimestamp?: { statusDate?: string; statusTime?: string };
      };
    };
  }[];
}

export interface ChainStation {
  name: string;
  route: string;
  lat: number;
  lon: number;
  status: RoadStatus;
  rawStatus: string;
  description: string;
  since: string | null;
}

export function parseCc(json: CcFeed): ChainStation[] {
  if (!Array.isArray(json?.data)) throw new Error('unexpected chain-control feed');
  return json.data
    .map(({ cc }) => cc)
    .filter((cc) => cc.inService !== 'false')
    .map((cc) => {
      const ts = cc.statusData.statusTimestamp;
      return {
        name: `${cc.location.locationName.replace(/[\s_]+$/g, '').replace(/(\s_)+/g, '').trim()} (${cc.location.direction})`,
        route: cc.location.route,
        lat: Number(cc.location.latitude),
        lon: Number(cc.location.longitude),
        status: normalizeChainStatus(cc.statusData.status, cc.statusData.statusDescription),
        rawStatus: cc.statusData.status,
        description: cc.statusData.statusDescription,
        since: ts?.statusDate ? `${ts.statusDate}T${(ts.statusTime ?? '00:00').slice(0, 5)}` : null,
      };
    });
}

// --- closures ------------------------------------------------------------------

interface LcsFeed {
  data: {
    lcs: {
      location: {
        travelFlowDirection: string;
        begin: { beginLocationName: string; beginLatitude: string; beginLongitude: string; beginRoute: string };
        end: { endLocationName: string };
      };
      closure: {
        facility: string;
        typeOfClosure: string;
        typeOfWork: string;
        closureTimestamp: { closureStartEpoch: string; closureEndEpoch: string; isClosureEndIndefinite: string };
        code1097: { isCode1097: string };
      };
    };
  }[];
}

export interface Closure {
  route: string;
  lat: number;
  lon: number;
  description: string;
  start: string | null;
  end: string | null;
}

const epochIso = (s: string) => (s && Number(s) > 0 ? new Date(Number(s) * 1000).toISOString() : null);

export function parseLcs(json: LcsFeed, at: Date): Closure[] {
  if (!Array.isArray(json?.data)) throw new Error('unexpected lane-closure feed');
  const t = at.getTime() / 1000;
  return json.data
    .map(({ lcs }) => lcs)
    .filter((c) => c.closure.facility === 'Mainline' && c.closure.typeOfClosure === 'Full')
    .filter((c) => {
      const start = Number(c.closure.closureTimestamp.closureStartEpoch);
      const end = Number(c.closure.closureTimestamp.closureEndEpoch);
      const indefinite = c.closure.closureTimestamp.isClosureEndIndefinite === 'true';
      const inPlace = c.closure.code1097.isCode1097 === 'true';
      return (inPlace || start <= t + UPCOMING_CLOSURE_HOURS * 3600) && (indefinite || !end || end >= t);
    })
    .map((c) => {
      const l = c.location;
      return {
        route: l.begin.beginRoute,
        lat: Number(l.begin.beginLatitude),
        lon: Number(l.begin.beginLongitude),
        description: `${l.travelFlowDirection}bound ${l.begin.beginLocationName} to ${l.end.endLocationName}: full closure (${c.closure.typeOfWork})`,
        start: epochIso(c.closure.closureTimestamp.closureStartEpoch),
        end: c.closure.closureTimestamp.isClosureEndIndefinite === 'true' ? null : epochIso(c.closure.closureTimestamp.closureEndEpoch),
      };
    });
}

// --- highway conditions text -----------------------------------------------------

export interface RoadsText {
  asOf: string | null;
  /** "I 80" → statements. */
  routes: Map<string, { area: string | null; text: string }[]>;
}

const NO_RESTRICTIONS = /no traffic restrictions are reported/i;

export function parseRoadsText(html: string): RoadsText {
  const asOf = html.match(/latest reported as of ([^<.]+(?:\.\d+)?[^<]*?)\.?<\/em>/i)?.[1]?.trim() ?? null;
  const routes = new Map<string, { area: string | null; text: string }[]>();
  for (const block of html.split(/<h3>/i).slice(1)) {
    const name = decodeEntities(block.slice(0, block.indexOf('</h3>'))).trim();
    const statements: { area: string | null; text: string }[] = [];
    let area: string | null = null;
    for (const [, p] of block.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
      const header = p.match(/<strong>\s*\[([^\]]+)\]\s*<\/strong>/i);
      if (header) area = header[1].trim();
      const text = decodeEntities(p.replace(/<strong>[\s\S]*?<\/strong>/gi, '').replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      if (text) statements.push({ area, text });
    }
    routes.set(name, statements);
  }
  return { asOf, routes };
}

// --- assembly ----------------------------------------------------------------------

export function buildSegment(
  seg: CaltransSegmentConfig,
  stations: ChainStation[],
  closures: Closure[],
  text: RoadsText | null,
): RoadSegment {
  const routes = new Set([seg.route, ...seg.aliases]);
  const matched = stations.filter((s) => routes.has(s.route) && inBox(s.lat, s.lon, seg.bbox));
  let status: RoadStatus = matched.length ? 'clear' : 'unknown';
  let worst: ChainStation | null = null;
  for (const s of matched) {
    if (SEVERITY.indexOf(s.status) > SEVERITY.indexOf(status)) {
      status = s.status;
      worst = s;
    }
  }
  const segClosures = closures.filter((c) => routes.has(c.route) && inBox(c.lat, c.lon, seg.bbox));
  if (segClosures.some((c) => !c.start || Date.parse(c.start) <= now().getTime())) status = 'closed';

  const patterns = seg.textMatch.map((m) => m.toLowerCase());
  const notes = (text?.routes.get(seg.textRoute) ?? [])
    .filter((s) => !NO_RESTRICTIONS.test(s.text))
    .filter((s) => patterns.length === 0 || patterns.some((p) => s.text.toLowerCase().includes(p)))
    .map((s) => s.text)
    .slice(0, 4);

  return {
    label: seg.label,
    route: seg.route,
    status,
    // "Chains R-2" is already Caltrans's own wording.
    restriction: null,
    stations: matched.length,
    worst: worst && { name: worst.name, status: worst.rawStatus, description: worst.description, since: worst.since },
    closures: segClosures.map(({ description, start, end }) => ({ description, start, end })),
    notes,
  };
}

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function fetchCaltrans(segs: CaltransSegmentConfig[]): Promise<{ segments: RoadSegment[]; textAsOf: string | null }> {
  const districts = [...new Set(segs.map((s) => s.district))];
  const textRoutes = [...new Set(segs.map((s) => s.textRoute.replace(/^\D+/, '')))];
  const [cc, lcs, text] = await Promise.all([
    Promise.all(districts.map((d) => fetchJson<CcFeed>(ccUrl(d)).then(parseCc))),
    // Closures and text are supplementary; the chain-control feed is the source of truth.
    settle(Promise.all(districts.map((d) => fetchJson<LcsFeed>(lcsUrl(d)).then((j) => parseLcs(j, now()))))),
    settle(fetchText(roadsTextUrl(textRoutes)).then(parseRoadsText)),
  ]);
  const stations = cc.flat();
  const closures = lcs?.flat() ?? [];
  return { segments: segs.map((seg) => buildSegment(seg, stations, closures, text)), textAsOf: text?.asOf ?? null };
}
