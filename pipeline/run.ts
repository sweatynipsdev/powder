// Fetch every source for every resort, process, and write public/data.
//
//   npm run pipeline            live fetch
//   npm run record-fixtures     live fetch + save every response to test/fixtures/http
//   npm run pipeline:replay     no network; replay the saved fixtures
//
// Env: POWDER_OUT_DIR (default public/data), PREVIOUS_DATA_URL (live site's /data/ for
// stale fallbacks; default: whatever is already in POWDER_OUT_DIR).

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataIndex, ForecastData, ModelCalibration, ModelId, ResortData, Sourced } from '../shared/types';
import { localIso, now } from './clock';
import { type Config, loadConfig, type ResortConfig } from './config';
import { appendHistory, type Calibration, loadCalibration } from './history';
import { clearFixtures, httpMode, initClockForMode, writeRecordingMeta } from './http';
import { EMPTY_PREVIOUS, loadPrevious, type Previous } from './previous';
import { buildForecast } from './process/forecast';
import { attempt, carryForward, errorMessage } from './process/stale';
import { fetchAvalanche } from './sources/avalanche';
import { fetchRoads } from './sources/caltrans';
import { fetchCpc } from './sources/cpc';
import { fetchAfd, fetchAlerts, fetchNwsForecast, filterAfd } from './sources/nws';
import { fetchNwsGrid } from './sources/nwsGrid';
import { FORECAST_DAYS, fetchDeterministic, fetchEnsemble } from './sources/openMeteo';
import { fetchExpert } from './sources/expert';
import { fetchReport } from './sources/report';
import { fetchSnowpack } from './sources/snowpack';
import { buildIndex, statusTable } from './summary';

export const DEFAULT_OUT_DIR = fileURLToPath(new URL('../public/data', import.meta.url));
export const DEFAULT_HISTORY_DIR = fileURLToPath(new URL('../history', import.meta.url));

async function buildForecastSource(
  r: ResortConfig,
  at: Date,
  calibration: Partial<Record<ModelId, ModelCalibration>> | undefined,
): Promise<Sourced<ForecastData>> {
  const [det, ens] = await Promise.all([attempt(() => fetchDeterministic(r), at), attempt(() => fetchEnsemble(r), at)]);
  if (!det.data) return { status: det.status, data: null };
  // The NWS forecasters' grids are a bonus: if they fail, the models still make a forecast.
  const times = det.data.times;
  const [nwsBase, nwsSummit] = await Promise.all([
    attempt(() => fetchNwsGrid(r.lat, r.lon, times, r.tz), at),
    r.summit ? attempt(() => fetchNwsGrid(r.summit!.lat, r.summit!.lon, times, r.tz), at) : null,
  ]);
  const nws = nwsBase.data || nwsSummit?.data ? { base: nwsBase.data, summit: nwsSummit?.data ?? null } : null;
  try {
    const data = buildForecast({ det: det.data, ens: ens.data, nws, calibration, nowLocal: localIso(at, r.tz), days: FORECAST_DAYS });
    const notes = [
      ens.status.ok ? null : `ensembles unavailable (ranges from models): ${ens.status.error}`,
      nwsBase.status.ok ? null : `NWS forecaster grid unavailable: ${nwsBase.status.error}`,
    ].filter(Boolean);
    return { status: notes.length ? { ...det.status, error: notes.join('; ') } : det.status, data };
  } catch (e) {
    return { status: { ok: false, stale: false, fetchedAt: null, error: `processing: ${errorMessage(e)}` }, data: null };
  }
}

/** Runs only when the resort configures the source; otherwise the field is null. */
function optional<T>(enabled: boolean, fn: () => Promise<T>, at: Date): Promise<Sourced<T>> | null {
  return enabled ? attempt(fn, at) : null;
}

export async function buildResort(
  r: ResortConfig,
  at: Date,
  prev: ResortData | undefined,
  calibration?: Partial<Record<ModelId, ModelCalibration>>,
): Promise<ResortData> {
  const [forecast, cpc, snowpack, nws, alerts, afd, avalanche, roads, report, expert] = await Promise.all([
    buildForecastSource(r, at, calibration),
    attempt(() => fetchCpc(r), at),
    optional(!!r.snowpack, () => fetchSnowpack(r), at),
    attempt(() => fetchNwsForecast(r), at),
    attempt(() => fetchAlerts(r), at),
    attempt(async () => filterAfd(await fetchAfd(r.nws.afdOffice), r.nws.ignore), at),
    optional(!!r.avalanche, () => fetchAvalanche(r), at),
    optional(r.roads.length > 0, () => fetchRoads(r), at),
    optional(!!r.report, () => fetchReport(r), at),
    optional(!!r.expert, () => fetchExpert(r), at),
  ]);

  return {
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    region: r.region,
    defaultFavorite: r.defaultFavorite,
    tz: r.tz,
    lat: r.lat,
    lon: r.lon,
    baseFt: r.baseFt,
    summitFt: r.summitFt,
    nwsArea: r.nws.area ?? r.region,
    generatedAt: at.toISOString(),
    forecast: carryForward(forecast, prev?.forecast),
    cpc: carryForward(cpc, prev?.cpc),
    snowpack: snowpack && carryForward(snowpack, prev?.snowpack),
    nws: carryForward(nws, prev?.nws),
    // Alerts expire; carrying old ones forward would show warnings that no longer exist.
    alerts,
    afd: carryForward(afd, prev?.afd),
    avalanche: avalanche && carryForward(avalanche, prev?.avalanche),
    roads: roads && carryForward(roads, prev?.roads),
    report: report && carryForward(report, prev?.report),
    expert: expert && carryForward(expert, prev?.expert),
    localNotes: r.local?.notes ?? [],
    openingDate: r.local?.openingDate,
    links: {
      website: r.links.website ?? null,
      webcams: r.links.webcams ?? null,
      cams: r.links.cams,
      radar: r.links.radar ?? null,
      roadCams: r.roadCams,
    },
    // The analysis step fills this in; keep the last one until then.
    analysis: prev?.analysis ?? null,
  };
}

export interface PipelineResult {
  index: DataIndex;
  resorts: ResortData[];
}

export async function runPipeline(
  config: Config,
  previous: Previous,
  at: Date = now(),
  calibration: Calibration = {},
): Promise<PipelineResult> {
  const resorts = await Promise.all(config.resorts.map((r) => buildResort(r, at, previous.resorts.get(r.id), calibration[r.id])));
  return { index: buildIndex(resorts, at, previous.index), resorts };
}

export function writeOutput(outDir: string, result: PipelineResult): void {
  mkdirSync(join(outDir, 'resorts'), { recursive: true });
  for (const r of result.resorts) writeFileSync(join(outDir, 'resorts', `${r.id}.json`), JSON.stringify(r));
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(result.index));
}

async function main(): Promise<void> {
  initClockForMode();
  if (httpMode() === 'record') clearFixtures();
  const at = now();
  const config = loadConfig();
  const outDir = process.env.POWDER_OUT_DIR || DEFAULT_OUT_DIR;
  const ids = config.resorts.map((r) => r.id);
  const previous =
    httpMode() === 'replay'
      ? EMPTY_PREVIOUS
      : await loadPrevious(ids, process.env.PREVIOUS_DATA_URL ? { url: process.env.PREVIOUS_DATA_URL } : { dir: outDir });

  // Live runs apply the local model's learned corrections. Only the scheduled runs
  // (POWDER_RECORD_HISTORY=1 in the workflow) add to the history it learns from, so local
  // test runs never pollute it.
  const live = httpMode() !== 'replay';
  const historyDir = process.env.POWDER_HISTORY_DIR || DEFAULT_HISTORY_DIR;
  const calibration = live ? loadCalibration(join(historyDir, 'calibration.json')) : {};

  const result = await runPipeline(config, previous, at, calibration);
  writeOutput(outDir, result);
  if (live && process.env.POWDER_RECORD_HISTORY === '1') appendHistory(historyDir, result.resorts, at);
  if (httpMode() === 'record') writeRecordingMeta(at);

  const table = statusTable(result.resorts);
  console.log(`Powder pipeline (${httpMode()}) at ${at.toISOString()} → ${outDir}\n\n${table}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Data sources\n\n${table}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
