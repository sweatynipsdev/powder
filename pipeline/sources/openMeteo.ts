// Open-Meteo deterministic models (forecast API) and ensembles (ensemble API).
// Both are requested for two "locations" at the same lat/lon with base and summit
// elevations, so Open-Meteo applies its lapse-rate correction for each.

import type { Elev, EnsembleInfo, ModelId, ModelInfo } from '../../shared/types';
import type { ResortConfig } from '../config';
import { fetchJson, qs } from '../http';
import type { Hourly, MemberSeries, ModelSeries } from '../process/blend';
import { omPacer, omWeight } from './omBudget';

export const FORECAST_DAYS = 16;
const FT_TO_M = 0.3048;

export const MODELS: { id: ModelId; om: string; label: string }[] = [
  { id: 'gfs', om: 'gfs_seamless', label: 'GFS' },
  // ECMWF's full-resolution 9 km run (open data since 2025), not the 0.25° version.
  { id: 'ecmwf', om: 'ecmwf_ifs', label: 'ECMWF' },
  { id: 'icon', om: 'icon_seamless', label: 'ICON' },
  { id: 'gem', om: 'gem_seamless', label: 'GEM' },
  { id: 'aifs', om: 'ecmwf_aifs025_single', label: 'ECMWF AI' },
  // Short-range, high-resolution: these resolve terrain best but only count for 48h.
  { id: 'hrrr', om: 'ncep_hrrr_conus', label: 'HRRR' },
  { id: 'nam', om: 'ncep_nam_conus', label: 'NAM 3km' },
  { id: 'nbm', om: 'ncep_nbm_conus', label: 'NBM' },
];

export const ENSEMBLES: { id: string; om: string; suffix: string; label: string; members: number }[] = [
  { id: 'gefs', om: 'gfs025', suffix: 'ncep_gefs025', label: 'GEFS', members: 31 },
  { id: 'ecmwf-ens', om: 'ecmwf_ifs025', suffix: 'ecmwf_ifs025_ensemble', label: 'ECMWF ENS', members: 51 },
];

const ENS_VARS = ['precipitation', 'temperature_2m'];

const DET_VARS = [
  'precipitation',
  'snowfall',
  'temperature_2m',
  'freezing_level_height',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'cloud_cover',
  'precipitation_probability',
];

/** What each request costs against Open-Meteo's free limits (both elevations). */
export const DET_WEIGHT = omWeight({ locations: 2, days: FORECAST_DAYS, variables: DET_VARS.length * MODELS.length });
export const ENS_WEIGHT = omWeight({
  locations: 2,
  days: FORECAST_DAYS,
  variables: ENS_VARS.length * ENSEMBLES.reduce((n, e) => n + e.members, 0),
});

interface OmLocation {
  elevation: number;
  hourly: Record<string, (number | null)[] | string[]>;
}

function locationParams(r: ResortConfig) {
  return {
    latitude: [r.lat, r.lat],
    longitude: [r.lon, r.lon],
    elevation: [Math.round(r.summitFt * FT_TO_M), Math.round(r.baseFt * FT_TO_M)],
    timezone: r.tz,
    forecast_days: FORECAST_DAYS,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
  };
}

const ELEV_ORDER: Elev[] = ['summit', 'base'];

const hasData = (a: Hourly | undefined): a is Hourly => !!a && a.some((v) => v !== null);

export interface DeterministicResult {
  times: string[];
  elevs: Record<Elev, Partial<Record<ModelId, ModelSeries>>>;
  models: ModelInfo[];
}

export function deterministicUrl(r: ResortConfig): string {
  return `https://api.open-meteo.com/v1/forecast?${qs({
    ...locationParams(r),
    hourly: DET_VARS,
    models: MODELS.map((m) => m.om),
  })}`;
}

export function parseDeterministic(json: unknown): DeterministicResult {
  const locs = json as OmLocation[];
  if (!Array.isArray(locs) || locs.length !== 2) throw new Error('expected 2 Open-Meteo locations');
  const times = locs[0].hourly.time as string[];
  const elevs = { summit: {}, base: {} } as DeterministicResult['elevs'];
  const hours = new Map<ModelId, number>();

  locs.forEach((loc, li) => {
    const h = loc.hourly as Record<string, Hourly>;
    for (const m of MODELS) {
      const precip = h[`precipitation_${m.om}`];
      const temp = h[`temperature_2m_${m.om}`];
      if (!hasData(precip) || !hasData(temp)) continue;
      elevs[ELEV_ORDER[li]][m.id] = {
        precip,
        temp,
        snowRaw: h[`snowfall_${m.om}`] ?? [],
        freezingFt: h[`freezing_level_height_${m.om}`] ?? [],
        wind: h[`wind_speed_10m_${m.om}`] ?? [],
        gust: h[`wind_gusts_10m_${m.om}`] ?? [],
        windDir: h[`wind_direction_10m_${m.om}`] ?? [],
        cloud: h[`cloud_cover_${m.om}`] ?? [],
        pop: h[`precipitation_probability_${m.om}`] ?? [],
      };
      hours.set(m.id, Math.max(hours.get(m.id) ?? 0, precip.filter((v) => v !== null).length));
    }
  });

  const models: ModelInfo[] = MODELS.filter((m) => hours.has(m.id)).map((m) => ({
    id: m.id,
    label: m.label,
    hours: hours.get(m.id)!,
  }));
  return { times, elevs, models };
}

/**
 * Open-Meteo drops connections in spells that outlast a few seconds; on 2026-10-23 one
 * resort failed all three attempts 1.5s and 4s apart and had no earlier forecast to fall back on.
 */
const OM_RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

export async function fetchDeterministic(r: ResortConfig): Promise<DeterministicResult> {
  // Paced per attempt, so retries count against the per-minute limit too.
  return parseDeterministic(
    await fetchJson(deterministicUrl(r), {
      timeoutMs: 45_000,
      retryDelaysMs: OM_RETRY_DELAYS_MS,
      gate: (request) => omPacer.run(DET_WEIGHT, request),
    }),
  );
}

export interface EnsembleResult {
  times: string[];
  elevs: Record<Elev, MemberSeries[]>;
  ensembles: EnsembleInfo[];
}

export function ensembleUrl(r: ResortConfig): string {
  return `https://ensemble-api.open-meteo.com/v1/ensemble?${qs({
    ...locationParams(r),
    hourly: ENS_VARS,
    models: ENSEMBLES.map((e) => e.om),
  })}`;
}

export function parseEnsemble(json: unknown): EnsembleResult {
  const locs = json as OmLocation[];
  if (!Array.isArray(locs) || locs.length !== 2) throw new Error('expected 2 Open-Meteo ensemble locations');
  const times = locs[0].hourly.time as string[];
  const elevs: EnsembleResult['elevs'] = { summit: [], base: [] };
  const info = new Map<string, EnsembleInfo>();

  locs.forEach((loc, li) => {
    const h = loc.hourly as Record<string, Hourly>;
    for (const key of Object.keys(h)) {
      const m = key.match(/^precipitation(?:_member(\d+))?_(.+)$/);
      if (!m) continue;
      const ens = ENSEMBLES.find((e) => e.suffix === m[2]);
      if (!ens) continue;
      const precip = h[key];
      const temp = h[key.replace(/^precipitation/, 'temperature_2m')];
      if (!hasData(precip) || !hasData(temp)) continue;
      elevs[ELEV_ORDER[li]].push({ precip, temp });
      if (li === 0) {
        const cur = info.get(ens.id) ?? { id: ens.id, label: ens.label, members: 0, hours: 0 };
        cur.members++;
        cur.hours = Math.max(cur.hours, precip.filter((v) => v !== null).length);
        info.set(ens.id, cur);
      }
    }
  });
  return { times, elevs, ensembles: ENSEMBLES.filter((e) => info.has(e.id)).map((e) => info.get(e.id)!) };
}

export async function fetchEnsemble(r: ResortConfig): Promise<EnsembleResult> {
  return parseEnsemble(
    await fetchJson(ensembleUrl(r), {
      timeoutMs: 60_000,
      retryDelaysMs: OM_RETRY_DELAYS_MS,
      gate: (request) => omPacer.run(ENS_WEIGHT, request),
    }),
  );
}
