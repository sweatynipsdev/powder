// How bad a road status is, shared by every agency's adapter.

import type { RoadStatus } from '../../shared/types';

export const SEVERITY: RoadStatus[] = ['unknown', 'clear', 'advisory', 'R-1', 'R-2', 'R-3', 'closed'];

export const worse = (a: RoadStatus, b: RoadStatus): RoadStatus => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a);
