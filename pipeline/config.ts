import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const link = z.object({ label: z.string(), url: z.url() });

const roadSegment = z.object({
  label: z.string(),
  /** Route as Caltrans writes it in the chain-control feed, e.g. "I-80", "SR-89", "US-395". */
  route: z.string(),
  /** Other route names to accept (Caltrans mislabels two Donner Summit stations "I-40"). */
  aliases: z.array(z.string()).default([]),
  district: z.number().int().min(1).max(12),
  /** [south, west, north, east] in degrees. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Route heading on roads.dot.ca.gov, e.g. "I 80", "SR 89". */
  textRoute: z.string(),
  /** A highway-conditions statement is kept if it mentions any of these. */
  textMatch: z.array(z.string()).default([]),
});

const resort = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  shortName: z.string(),
  region: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  baseFt: z.number().positive(),
  summitFt: z.number().positive(),
  /** An upper-mountain point, so the NWS forecasters' grid can be read near the summit too. */
  summit: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tz: z.string(),
  /** Starred on a phone that hasn't picked its own favorites yet. */
  defaultFavorite: z.boolean().default(false),
  nws: z.object({
    /** Office whose forecast discussion is read; defaults to the office covering the base point. */
    afdOffice: z.string().length(3).optional(),
    /** The part of the office's region this resort sits in, so the write-up ignores the rest. */
    area: z.string().optional(),
    /** Forecast-discussion sentences mentioning any of these (other parts of the region) are dropped. */
    ignore: z.array(z.string()).default([]),
  }),
  snowpack: z
    .object({
      type: z.enum(['awdb', 'cdec', 'acis']),
      id: z.string(),
      name: z.string(),
      elevFt: z.number(),
    })
    .optional(),
  avalanche: z.object({ center: z.string(), zoneId: z.number().int() }).optional(),
  report: z
    .object({
      adapter: z.literal('mtnpowder'),
      resortId: z.number().int(),
      /** SnowReport keys to read, base → summit. */
      stations: z.array(z.string()).min(1),
      /** Count lifts/trails only in these mountain areas (for split resorts like Palisades/Alpine). */
      areas: z.array(z.string()).optional(),
      /** Additional feeds whose lifts/trails are summed in (Snow Summit into Big Bear). */
      extraResortIds: z.array(z.number().int()).default([]),
    })
    .optional(),
  /** Local knowledge for the forecast writer, with the sources it came from. */
  local: z
    .object({
      notes: z.array(z.string()).default([]),
      sources: z.array(z.url()).default([]),
      /** Scheduled opening day (YYYY-MM-DD), shown as "Opening Nov 25" until lifts run. */
      openingDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .optional(),
  /**
   * A local human forecaster whose page is read for the writer (WordPress REST API). Their
   * text is private input: the app shows only who, when and a link, never their words.
   */
  expert: z
    .object({
      adapter: z.literal('wordpress-page'),
      source: z.string(),
      author: z.string(),
      api: z.url(),
      url: z.url(),
      /** Everything from this phrase on is boilerplate (FAQ, bio) and is dropped. */
      cutAt: z.string().optional(),
    })
    .optional(),
  roads: z.array(roadSegment).default([]),
  roadCams: z.array(link).default([]),
  links: z
    .object({
      website: z.url().optional(),
      webcams: z.url().optional(),
      cams: z.array(link).default([]),
      radar: z.url().optional(),
    })
    .default({ cams: [] }),
});

const config = z
  .object({ resorts: z.array(resort).min(1) })
  .refine((c) => new Set(c.resorts.map((r) => r.id)).size === c.resorts.length, 'resort ids must be unique')
  .refine((c) => c.resorts.every((r) => r.summitFt > r.baseFt), 'summitFt must be above baseFt');

export type ResortConfig = z.infer<typeof resort>;
export type RoadSegmentConfig = z.infer<typeof roadSegment>;
export type Config = z.infer<typeof config>;

export const CONFIG_PATH = fileURLToPath(new URL('../resorts.json', import.meta.url));

export function parseConfig(json: unknown): Config {
  return config.parse(json);
}

export function loadConfig(path = CONFIG_PATH): Config {
  return parseConfig(JSON.parse(readFileSync(path, 'utf8')));
}
