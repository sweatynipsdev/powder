// The NWS forecasters' own gridded forecast (api.weather.gov /gridpoints): snowfall,
// precipitation, snow level and precip chance on a 2.5 km grid, about 7 days out. Forecasters
// at each office hand-edit these grids, so this is the local human forecast in numbers.

import { localIso } from '../clock';
import { fetchJson } from '../http';
import type { Hourly } from '../process/blend';

const HEADERS = { Accept: 'application/geo+json' };
const MM_TO_IN = 1 / 25.4;
const M_TO_FT = 3.28084;

interface GridLayer {
  uom?: string;
  values: { validTime: string; value: number | null }[];
}

interface GridResponse {
  properties: {
    elevation?: { value: number };
    snowfallAmount?: GridLayer;
    quantitativePrecipitation?: GridLayer;
    snowLevel?: GridLayer;
    probabilityOfPrecipitation?: GridLayer;
  };
}

export interface NwsGrid {
  elevationFt: number | null;
  snow: Hourly;
  precip: Hourly;
  snowLevelFt: Hourly;
  pop: Hourly;
}

/** ISO 8601 duration → hours: "PT6H" → 6, "P1DT6H" → 30, "P1D" → 24. */
export function durationHours(d: string): number {
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 1;
  return Math.max(1, Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0));
}

/**
 * Spreads interval values onto the hourly (hour-ending, local) time axis. Totals ("sum") are
 * divided evenly across the interval's hours; states like snow level are copied to each hour.
 */
export function gridToHourly(
  layer: GridLayer | undefined,
  times: string[],
  tz: string,
  mode: 'sum' | 'state',
  convert: (v: number) => number,
): Hourly {
  const out: Hourly = new Array(times.length).fill(null);
  if (!layer) return out;
  const index = new Map(times.map((t, i) => [t, i]));
  for (const { validTime, value } of layer.values) {
    if (value === null || value === undefined) continue;
    const [start, dur] = validTime.split('/');
    const n = durationHours(dur ?? 'PT1H');
    const t0 = Date.parse(start);
    for (let k = 1; k <= n; k++) {
      const i = index.get(localIso(new Date(t0 + k * 3_600_000), tz));
      if (i === undefined) continue;
      out[i] = mode === 'sum' ? convert(value) / n : convert(value);
    }
  }
  return out;
}

export function parseGrid(json: GridResponse, times: string[], tz: string): NwsGrid {
  const p = json.properties;
  if (!p?.snowfallAmount && !p?.quantitativePrecipitation) throw new Error('NWS grid has no snowfall or precipitation');
  return {
    elevationFt: p.elevation?.value ? Math.round(p.elevation.value * M_TO_FT) : null,
    snow: gridToHourly(p.snowfallAmount, times, tz, 'sum', (v) => v * MM_TO_IN),
    precip: gridToHourly(p.quantitativePrecipitation, times, tz, 'sum', (v) => v * MM_TO_IN),
    snowLevelFt: gridToHourly(p.snowLevel, times, tz, 'state', (v) => v * M_TO_FT),
    pop: gridToHourly(p.probabilityOfPrecipitation, times, tz, 'state', (v) => v),
  };
}

export async function fetchNwsGrid(lat: number, lon: number, times: string[], tz: string): Promise<NwsGrid> {
  const points = await fetchJson<{ properties: { forecastGridData: string } }>(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    { headers: HEADERS },
  );
  return parseGrid(await fetchJson<GridResponse>(points.properties.forecastGridData, { headers: HEADERS }), times, tz);
}
