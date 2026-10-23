// Resort-reported snow and lifts. Palisades, Mammoth and Big Bear all publish through
// MtnPowder (Alterra's snow-report vendor); their own report pages load this same feed.

import type { ReportArea, ReportData } from '../../shared/types';
import type { ResortConfig } from '../config';
import { hoursBetween, now } from '../clock';
import { fetchJson } from '../http';

type ReportConfig = NonNullable<ResortConfig['report']>;

export const FRESH_HOURS = 36;

export const mtnpowderUrl = (resortId: number) => `https://www.mtnpowder.com/feed?resortId=${resortId}`;

interface MpArea {
  Name?: string;
  BaseIn?: string;
  Last24HoursIn?: string;
  Last48HoursIn?: string;
  Last72HoursIn?: string;
  Last7DaysIn?: string;
}

interface MpFeed {
  Name: string;
  OperatingStatus?: string;
  SnowReport: Record<string, unknown> & {
    LastUpdate?: string;
    BaseConditions?: string;
    SeasonTotalIn?: string;
    TotalOpenLifts?: number;
    TotalLifts?: number;
    TotalOpenTrails?: number;
    TotalTrails?: number;
  };
  MountainAreas?: {
    Name: string;
    OpenTrailsCount?: number;
    TotalTrailsCount?: number;
    Lifts?: { StatusEnglish?: string }[];
  }[];
}

/** MtnPowder sends numbers as strings and "--" for missing. */
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s === '' || s === '--') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "2026-06-08T10:02:25-0700" → "2026-06-08T10:02:25-07:00". */
export function normalizeTimestamp(s: string | undefined): string | null {
  if (!s) return null;
  const fixed = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  return Number.isNaN(Date.parse(fixed)) ? null : fixed;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== '--' ? v.trim() : null);

function liftsIn(feed: MpFeed, areas: string[] | undefined): { open: number; total: number; trailsOpen: number; trailsTotal: number } {
  if (!areas) {
    const sr = feed.SnowReport;
    return {
      open: num(sr.TotalOpenLifts) ?? 0,
      total: num(sr.TotalLifts) ?? 0,
      trailsOpen: num(sr.TotalOpenTrails) ?? 0,
      trailsTotal: num(sr.TotalTrails) ?? 0,
    };
  }
  const picked = (feed.MountainAreas ?? []).filter((a) => areas.includes(a.Name));
  const lifts = picked.flatMap((a) => a.Lifts ?? []);
  return {
    open: lifts.filter((l) => l.StatusEnglish === 'open').length,
    total: lifts.length,
    trailsOpen: picked.reduce((s, a) => s + (a.OpenTrailsCount ?? 0), 0),
    trailsTotal: picked.reduce((s, a) => s + (a.TotalTrailsCount ?? 0), 0),
  };
}

export function parseMtnpowder(cfg: ReportConfig, main: MpFeed, extras: MpFeed[], at: Date): ReportData {
  const sr = main?.SnowReport;
  if (!sr) throw new Error('MtnPowder feed has no SnowReport');

  const areas: ReportArea[] = cfg.stations
    .map((key) => sr[key] as MpArea | undefined)
    .filter((a): a is MpArea => !!a && typeof a === 'object')
    .map((a) => ({
      name: text(a.Name) ?? '',
      baseDepthIn: num(a.BaseIn),
      h24: num(a.Last24HoursIn),
      h48: num(a.Last48HoursIn),
      h72: num(a.Last72HoursIn),
      d7: num(a.Last7DaysIn),
    }))
    // Unused stations come through as "--" with no values.
    .filter((a) => a.name || [a.baseDepthIn, a.h24, a.h48, a.h72, a.d7].some((v) => v !== null));
  // Stations are listed base → summit; prefer the highest one that reports.
  const top = <K extends keyof ReportArea>(k: K) => [...areas].reverse().find((a) => a[k] !== null)?.[k] ?? null;

  const counts = [liftsIn(main, cfg.areas), ...extras.map((f) => liftsIn(f, undefined))].reduce((a, b) => ({
    open: a.open + b.open,
    total: a.total + b.total,
    trailsOpen: a.trailsOpen + b.trailsOpen,
    trailsTotal: a.trailsTotal + b.trailsTotal,
  }));

  const updatedAt = normalizeTimestamp(sr.LastUpdate);
  return {
    name: main.Name,
    updatedAt,
    fresh: updatedAt !== null && hoursBetween(new Date(updatedAt), at) <= FRESH_HOURS,
    operatingStatus: text(main.OperatingStatus),
    conditions: text(sr.BaseConditions),
    areas,
    h24: top('h24') as number | null,
    h48: top('h48') as number | null,
    d7: top('d7') as number | null,
    baseDepthIn: top('baseDepthIn') as number | null,
    seasonTotalIn: num(sr.SeasonTotalIn),
    liftsOpen: counts.total ? counts.open : null,
    liftsTotal: counts.total || null,
    trailsOpen: counts.trailsTotal ? counts.trailsOpen : null,
    trailsTotal: counts.trailsTotal || null,
  };
}

export async function fetchReport(r: ResortConfig): Promise<ReportData> {
  const cfg = r.report;
  if (!cfg) throw new Error('no report adapter configured');
  const [main, ...extras] = await Promise.all(
    [cfg.resortId, ...cfg.extraResortIds].map((id) => fetchJson<MpFeed>(mtnpowderUrl(id))),
  );
  return parseMtnpowder(cfg, main, extras, now());
}
