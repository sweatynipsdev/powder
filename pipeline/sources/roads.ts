// Road conditions for the drive, from whichever agency runs each road: Caltrans for
// California, WSDOT's pass reports for Washington. Segments keep their config order.

import type { RoadSegment, RoadStatus, RoadsData } from '../../shared/types';
import type { CaltransSegmentConfig, ResortConfig, WsdotSegmentConfig } from '../config';
import { fetchCaltrans } from './caltrans';
import { worse } from './roadStatus';

const AGENCY = { caltrans: 'Caltrans', wsdot: 'WSDOT' } as const;

export async function fetchRoads(r: ResortConfig): Promise<RoadsData> {
  const caltrans = r.roads.filter((s): s is CaltransSegmentConfig => s.provider === 'caltrans');
  const wsdot = r.roads.filter((s): s is WsdotSegmentConfig => s.provider === 'wsdot');
  if (wsdot.length) throw new Error('WSDOT roads are not implemented yet');
  const ct = caltrans.length ? await fetchCaltrans(caltrans) : null;

  const built = new Map<object, RoadSegment>();
  caltrans.forEach((cfg, i) => built.set(cfg, ct!.segments[i]));
  const segments = r.roads.map((cfg) => built.get(cfg)!);
  return {
    segments,
    worst: segments.reduce<RoadStatus>((w, s) => worse(w, s.status), 'unknown'),
    textAsOf: ct?.textAsOf ?? null,
    agencies: [...new Set(r.roads.map((s) => AGENCY[s.provider]))],
  };
}
