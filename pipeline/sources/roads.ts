// Road conditions for the drive, from whichever agency runs each road: Caltrans for
// California, WSDOT's pass reports for Washington. Segments keep their config order.

import type { RoadSegment, RoadStatus, RoadsData } from '../../shared/types';
import type { CaltransSegmentConfig, ResortConfig, WsdotSegmentConfig } from '../config';
import { fetchCaltrans } from './caltrans';
import { worse } from './roadStatus';
import { fetchWsdot } from './wsdot';

const AGENCY = { caltrans: 'Caltrans', wsdot: 'WSDOT' } as const;

export async function fetchRoads(r: ResortConfig): Promise<RoadsData> {
  const caltrans = r.roads.filter((s): s is CaltransSegmentConfig => s.provider === 'caltrans');
  const wsdot = r.roads.filter((s): s is WsdotSegmentConfig => s.provider === 'wsdot');
  const [ct, wa] = await Promise.all([caltrans.length ? fetchCaltrans(caltrans) : null, wsdot.length ? fetchWsdot(wsdot) : []]);

  // Each agency returns its segments in the order given; interleave them back into config order.
  let c = 0;
  let w = 0;
  const segments: RoadSegment[] = r.roads.map((cfg) => (cfg.provider === 'caltrans' ? ct!.segments[c++] : wa[w++]));
  return {
    segments,
    worst: segments.reduce<RoadStatus>((w, s) => worse(w, s.status), 'unknown'),
    textAsOf: ct?.textAsOf ?? null,
    agencies: [...new Set(r.roads.map((s) => AGENCY[s.provider]))],
  };
}
