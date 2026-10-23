// The structured brief the model writes from: every number pre-formatted the way the app
// shows it, labeled, and nothing it doesn't need. No raw hourly arrays.

import { confidenceOf } from '../pipeline/process/blend';
import { fmtDay, fmtFt, fmtSnow, fmtSnowAmount } from '../shared/format';
import { beforeOpening } from '../shared/status';
import type { CpcCat, DaySummary, ModelId, Period, ReportData, ResortData, RoadSegment, SnowAmount, SourceKey } from '../shared/types';

const MODEL_LABEL: Record<ModelId, string> = {
  gfs: 'GFS',
  ecmwf: 'ECMWF',
  icon: 'ICON',
  gem: 'GEM',
  aifs: 'ECMWF AI',
  hrrr: 'HRRR',
  nam: 'NAM 3km',
  nbm: 'NBM',
  nws: 'NWS forecasters',
};

const CAT_TEXT = { above: 'above normal', below: 'below normal', normal: 'near normal', ec: 'equal chances' } as const;

function cpcText(c: CpcCat | null): string {
  if (!c) return 'n/a';
  return c.prob === null ? CAT_TEXT[c.cat] : `${CAT_TEXT[c.cat]} (${c.prob}% chance)`;
}

function models(a: SnowAmount): Record<string, string> {
  return Object.fromEntries((Object.entries(a.models) as [ModelId, number][]).map(([id, v]) => [MODEL_LABEL[id], fmtSnow(v)]));
}

function span(min: number | null, max: number | null, fmt: (n: number) => string = String): string {
  if (min === null || max === null) return 'n/a';
  return min === max ? fmt(min) : `${fmt(min)} to ${fmt(max)}`;
}

/**
 * What the snow level means on this mountain, spelled out so the writer doesn't have to
 * reason about it (a snow level above the summit means rain everywhere, not snow).
 */
export function snowLevelMeaning(min: number | null, max: number | null, baseFt: number, summitFt: number): string {
  if (min === null || max === null) return 'n/a';
  if (max <= baseFt) return 'below the base: any precipitation is snow top to bottom';
  if (min >= summitFt) return 'above the summit: any precipitation falls as rain on the whole mountain';
  if (min >= baseFt) return 'between base and summit: snow up high, rain or a mix lower down';
  return 'near the base: mostly snow, possibly a mix at the bottom';
}

function nearDay(d: DaySummary, day: Period, night: Period, r: ResortData) {
  return {
    date: fmtDay(d.date),
    summitSnow: { daytime: fmtSnow(day.snow.summit.blend), overnight: fmtSnow(night.snow.summit.blend), total: fmtSnowAmount(d.snow.summit) },
    baseSnow: fmtSnowAmount(d.snow.base),
    confidence: d.confidence ?? 'n/a',
    models: models(d.snow.summit),
    snowLevelFt: span(d.snowLevelFt.min, d.snowLevelFt.max, fmtFt),
    snowLevelMeaning: snowLevelMeaning(d.snowLevelFt.min, d.snowLevelFt.max, r.baseFt, r.summitFt),
    rainAtBase: day.rainAtBase || night.rainAtBase ? 'yes' : 'no',
    summitTempF: lowHigh(d.tempF.summit.min, d.tempF.summit.max),
    baseTempF: lowHigh(d.tempF.base.min, d.tempF.base.max),
    forecastMaxGustMph: d.gustMph ?? 'n/a',
  };
}

/** "low 18, high 29": a bare "18 to 29" got written up as a range of highs. */
const lowHigh = (min: number | null, max: number | null) => (min === null || max === null ? 'n/a' : `low ${min}, high ${max}`);

function farDay(d: DaySummary, r: ResortData) {
  return {
    date: fmtDay(d.date),
    summitSnow: fmtSnowAmount(d.snow.summit),
    confidence: d.confidence ?? 'n/a',
    models: models(d.snow.summit),
    snowLevelFt: span(d.snowLevelFt.min, d.snowLevelFt.max, fmtFt),
    snowLevelMeaning: snowLevelMeaning(d.snowLevelFt.min, d.snowLevelFt.max, r.baseFt, r.summitFt),
  };
}

const confidenceLabel = (a: SnowAmount) => confidenceOf(a) ?? 'n/a';

/** Days since an ISO timestamp, rounded down. */
const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);

/** A recent local forecaster's discussion, credited, for the writer to compare against. */
function localExpert(r: ResortData, now: Date): { localExpert?: object } {
  const x = r.expert?.data;
  if (!x?.publishedAt || (now.getTime() - Date.parse(x.publishedAt)) / 86_400_000 > EXPERT_MAX_AGE_DAYS) return {};
  return {
    localExpert: {
      who: `${x.author}, ${x.source} (local forecaster)`,
      updated: ago(x.publishedAt, now),
      discussion: x.text,
    },
  };
}

/** How long after its opening day a resort with no current report is presumed to be running. */
const SEASON_DAYS = 150;

/** Whether the resort is open, stated outright so the write-up doesn't assume. */
export function resortStatus(r: ResortData, now: Date): string {
  const rep = r.report?.data;
  const upcoming = beforeOpening(r.openingDate, now, r.tz) ? fmtDay(r.openingDate!) : null;
  // With no current report (none, or an old one), the opening date is the best evidence.
  if (!rep?.fresh) {
    if (upcoming) return `not open yet: scheduled to open ${upcoming}`;
    if (r.openingDate && daysSince(`${r.openingDate}T12:00:00Z`, now) <= SEASON_DAYS)
      return `likely open: its scheduled opening day (${fmtDay(r.openingDate)}) has passed, but no current lift report confirms it`;
    if (!rep && r.report) return 'unknown: the lift report could not be read this run, so it is not confirmed open';
  }
  return statusText(rep, now) + (upcoming && !rep?.liftsOpen ? `; scheduled to open ${upcoming}` : '');
}

function statusText(rep: ReportData | null | undefined, now: Date): string {
  if (!rep) return 'unknown: this resort publishes no lift report we can read, so it is not confirmed open';
  if (!rep.fresh) {
    if (!rep.updatedAt) return 'unknown (no current report)';
    const age = daysSince(rep.updatedAt, now);
    return age > 14
      ? `not open: the last resort report is from ${fmtDay(rep.updatedAt.slice(0, 10))}, so it is closed for the season or not open yet`
      : `unknown: the resort report hasn't updated in ${age} days`;
  }
  if (rep.liftsTotal === null) return rep.operatingStatus ?? 'unknown';
  return rep.liftsOpen ? `open: ${rep.liftsOpen} of ${rep.liftsTotal} lifts running` : `not open yet: 0 of ${rep.liftsTotal} lifts running`;
}

function snowOnGround(r: ResortData): string {
  const sp = r.snowpack?.data;
  if (!sp || sp.depthIn === null) return 'unknown';
  return sp.depthIn <= 0 ? `none at the ${sp.station.name} station` : `${sp.depthIn} inches at the ${sp.station.name} station`;
}

/** The agency's own wording when it has one (WSDOT), otherwise Caltrans's terms. */
export function roadStatusText(s: RoadSegment): string {
  if (s.restriction) return s.restriction;
  if (s.status === 'clear') return 'no restrictions';
  if (s.status === 'advisory') return 'traction tires advised';
  if (s.status === 'closed') return 'CLOSED';
  if (s.status === 'unknown') return 'unknown';
  return `chain control ${s.status}`;
}

/** The drive's worst segment, in the same words as the resort brief. */
function worstRoadText(r: ResortData): string {
  const roads = r.roads?.data;
  const seg = roads?.segments.find((s) => s.status === roads.worst);
  return seg ? roadStatusText(seg) : 'n/a';
}

function ago(iso: string | null, now: Date): string {
  if (!iso) return 'unknown time';
  const h = Math.round((now.getTime() - Date.parse(iso)) / 3_600_000);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
}

const SOURCE_TEXT: Record<SourceKey, string> = {
  forecast: 'model forecast',
  cpc: 'CPC outlooks',
  snowpack: 'snowpack station',
  nws: 'NWS point forecast',
  alerts: 'NWS alerts',
  afd: 'NWS forecast discussion',
  avalanche: 'avalanche forecast',
  roads: 'road conditions',
  report: 'resort snow report',
  expert: 'local forecaster',
};

/** A local forecaster's discussion older than this isn't about the current forecast. */
const EXPERT_MAX_AGE_DAYS = 4;

export interface Brief {
  resort: string;
  json: string;
}

export function buildBrief(r: ResortData, now: Date): Brief {
  const f = r.forecast.data;
  const sp = r.snowpack?.data;
  const rep = r.report?.data;
  const av = r.avalanche?.data;

  const unavailable = (Object.keys(SOURCE_TEXT) as SourceKey[]).flatMap((k) => {
    const s = r[k];
    if (!s || s.status.ok) return [];
    return [s.data ? `${SOURCE_TEXT[k]}: using data from ${ago(s.status.fetchedAt, now)}` : `${SOURCE_TEXT[k]}: unavailable`];
  });

  const brief = {
    resort: { name: r.name, region: r.region, baseFt: fmtFt(r.baseFt), summitFt: fmtFt(r.summitFt) },
    writtenFor: `${fmtDay(now.toLocaleDateString('en-CA', { timeZone: r.tz }))}, ${now.toLocaleTimeString('en-US', { timeZone: r.tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`,
    howToRead:
      'Snow in inches. "X (A-B)" means best estimate X, likely range A to B (middle half of ensemble members, or the spread of models when ensembles are missing). "<1" means a dusting under an inch. Daytime is 5am-5pm, overnight is 5pm-5am the next morning. "models" are single runs of each forecast model (GFS, ECMWF, ICON, GEM, ECMWF AI, and the short-range HRRR, NAM 3km and NBM); "NWS forecasters" is the hand-edited forecast from the local National Weather Service office. The ensembles are separate and only feed the ranges. Gusts and temperatures are forecasts, not measurements.',
    resortStatus: resortStatus(r, now),
    ...(r.localNotes?.length ? { localKnowledge: r.localNotes } : {}),
    ...localExpert(r, now),
    snowOnGround: snowOnGround(r),
    next5Days: f ? f.days.slice(0, 5).map((d, i) => nearDay(d, f.periods[2 * i], f.periods[2 * i + 1], r)) : 'unavailable',
    days6to16: f ? f.days.slice(5).map((d) => farDay(d, r)) : 'unavailable',
    totals: f
      ? {
          next24Hours: { summit: fmtSnowAmount(f.windows.next24h.summit), base: fmtSnowAmount(f.windows.next24h.base) },
          next72Hours: { summit: fmtSnowAmount(f.windows.next72h.summit), base: fmtSnowAmount(f.windows.next72h.base) },
          next7Days: { summit: fmtSnowAmount(f.windows.next7d.summit), base: fmtSnowAmount(f.windows.next7d.base) },
          days1to5: { summit: fmtSnowAmount(f.buckets.d1_5.summit), models: models(f.buckets.d1_5.summit) },
          days6to10: {
            summit: fmtSnowAmount(f.buckets.d6_10.summit),
            wetScenario: fmtSnow(f.buckets.d6_10.summit.p90),
            models: models(f.buckets.d6_10.summit),
          },
          days11to16: {
            summit: fmtSnowAmount(f.buckets.d11_16.summit),
            wetScenario: fmtSnow(f.buckets.d11_16.summit.p90),
            models: models(f.buckets.d11_16.summit),
          },
          note: 'wetScenario = what the wettest 10% of ensemble members show; not a forecast.',
        }
      : 'unavailable',
    ensembles: f?.ensembles.length
      ? f.ensembles.map((e) => `${e.label}: ${e.members} members, out to day ${Math.floor(e.hours / 24)}`)
      : 'ensembles unavailable; ranges are model spread',
    cpcOutlooks: r.cpc.data
      ? r.cpc.data.outlooks.map((o) => ({
          period: `${o.label}${o.valid ? ` (${o.valid})` : ''}`,
          temperature: cpcText(o.temp),
          precipitation: cpcText(o.precip),
        }))
      : 'unavailable',
    enso: r.cpc.data?.enso ? `${r.cpc.data.enso.status}. ${r.cpc.data.enso.synopsis}` : 'n/a',
    observed: {
      snowStation: sp
        ? {
            station: `${sp.station.name} (${fmtFt(sp.station.elevFt)} ft)`,
            observed: sp.observedAt,
            depthIn: sp.depthIn ?? 'n/a',
            sweIn: sp.sweIn ?? 'n/a',
            depthChangeIn: { last24h: sp.change.h24.depthIn ?? 'n/a', last48h: sp.change.h48.depthIn ?? 'n/a', last7d: sp.change.d7.depthIn ?? 'n/a' },
            ...(sp.newSnow ? { newSnowIn: { last24h: sp.newSnow.h24 ?? 'n/a', last7d: sp.newSnow.d7 ?? 'n/a' } } : {}),
            ...(sp.note ? { note: sp.note } : {}),
          }
        : 'none',
      resortReport: rep
        ? {
            updated: rep.updatedAt,
            current: rep.fresh ? 'yes' : 'NO - stale off-season report, do not treat as current conditions',
            newSnowIn: { last24h: rep.h24 ?? 'n/a', last48h: rep.h48 ?? 'n/a', last7d: rep.d7 ?? 'n/a' },
            baseDepthIn: rep.baseDepthIn ?? 'n/a',
            liftsOpen: rep.liftsTotal ? `${rep.liftsOpen} of ${rep.liftsTotal}` : 'n/a',
          }
        : 'none',
    },
    alerts: (r.alerts.data ?? []).map((a) => a.headline),
    avalanche: av
      ? av.overall < 0
        ? `${av.zoneName}: no danger rating issued yet${av.bottomLine ? `. ${av.bottomLine}` : ''}`
        : { zone: av.zoneName, overall: av.overallText, problems: av.problems, bottomLine: av.bottomLine }
      : 'no avalanche center',
    roads: r.roads?.data
      ? r.roads.data.segments.map((s) => ({
          route: s.label,
          status: roadStatusText(s),
          ...(s.notes.length ? { notes: s.notes } : {}),
        }))
      : 'n/a',
    nwsDiscussion: r.afd.data
      ? {
          appliesTo: `Written for the whole ${r.afd.data.office} forecast region. Only use what it says about ${r.nwsArea} or the region as a whole; ignore other areas it mentions.`,
          office: r.afd.data.office,
          issued: r.afd.data.issuedAt,
          keyMessages: r.afd.data.keyMessages,
          discussion: r.afd.data.discussion,
        }
      : 'unavailable',
    nwsForecast: r.nws.data ? r.nws.data.periods.slice(0, 4).map((p) => `${p.name}: ${p.detailedForecast}`) : 'unavailable',
    unavailable,
  };

  return { resort: r.name, json: JSON.stringify(brief, null, 1) };
}

/** Per-resort facts for the cross-resort ranking. */
export function buildRankingBrief(resorts: ResortData[], now: Date): string {
  const items = resorts.map((r) => {
    const f = r.forecast.data;
    return {
      id: r.id,
      name: r.name,
      region: r.region,
      next7Days: f
        ? f.days.slice(0, 7).map((d, i) => ({
            date: d.date,
            day: fmtDay(d.date),
            summitSnow: { daytime: fmtSnow(f.periods[2 * i].snow.summit.blend), overnight: fmtSnow(f.periods[2 * i + 1].snow.summit.blend), total: fmtSnowAmount(d.snow.summit) },
            confidence: d.confidence ?? 'n/a',
            forecastMaxGustMph: d.gustMph ?? 'n/a',
            rainAtBase: f.periods[2 * i].rainAtBase || f.periods[2 * i + 1].rainAtBase,
          }))
        : 'unavailable',
      days6to10Summit: f ? `${fmtSnowAmount(f.buckets.d6_10.summit)}, confidence ${confidenceLabel(f.buckets.d6_10.summit)}` : 'unavailable',
      resortStatus: resortStatus(r, now),
      roads: worstRoadText(r),
      avalanche: r.avalanche?.data ? r.avalanche.data.overallText : 'n/a',
      headline: r.analysis?.headline ?? null,
    };
  });
  return JSON.stringify(
    {
      writtenFor: fmtDay(now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })),
      howToRead:
        'Snow in inches at the summit. "X (A-B)": best estimate X, likely range A-B. Overnight snow falls 5pm-5am, so it is fresh for the NEXT day. Gusts are forecasts.',
      resorts: items,
    },
    null,
    1,
  );
}
