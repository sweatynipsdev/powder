import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../pipeline/config';
import { parseAvalanche } from '../../pipeline/sources/avalanche';
import { buildSegment, normalizeChainStatus, parseCc, parseRoadsText, worse } from '../../pipeline/sources/caltrans';
import { kmlPoint, normalizeCategory, parseArcPoint, parseEnso, parseKml, pointInRing } from '../../pipeline/sources/cpc';
import { afdSections, filterAfd, parseAfd, parseAlerts, unwrap } from '../../pipeline/sources/nws';
import { parseDeterministic, parseEnsemble } from '../../pipeline/sources/openMeteo';
import { normalizeTimestamp, num, parseMtnpowder } from '../../pipeline/sources/report';
import { cdecDate, cocorahsStation, parseAcis, parseAwdb, parseCdec } from '../../pipeline/sources/snowpack';
import { fixtureJson, fixtureText, recordedAt } from '../helpers';

const config = loadConfig();
const resort = (id: string) => config.resorts.find((r) => r.id === id)!;

describe('Open-Meteo', () => {
  it('parses all six deterministic models at both elevations', () => {
    const det = parseDeterministic(fixtureJson('api.open-meteo.com/v1/forecast?latitude=39.1969'));
    expect(det.models.map((m) => m.id)).toEqual(['gfs', 'ecmwf', 'icon', 'gem', 'hrrr', 'nbm']);
    expect(Object.keys(det.elevs.summit)).toHaveLength(6);
    expect(det.times[0]).toMatch(/T00:00$/);
    // ICON stops around day 7; GFS runs the full 16 days.
    expect(det.models.find((m) => m.id === 'icon')!.hours).toBeLessThan(200);
    expect(det.models.find((m) => m.id === 'gfs')!.hours).toBe(det.times.length);
    // Summit is colder than base at the same hour.
    const h = 12;
    expect(det.elevs.summit.gfs!.temp[h]!).toBeLessThan(det.elevs.base.gfs!.temp[h]!);
  });

  it('parses GEFS and ECMWF ensemble members', () => {
    const ens = parseEnsemble(fixtureJson('ensemble-api.open-meteo.com/v1/ensemble?latitude=39.1969'));
    expect(ens.ensembles).toEqual([
      expect.objectContaining({ id: 'gefs', members: 31 }),
      expect.objectContaining({ id: 'ecmwf-ens', members: 51 }),
    ]);
    expect(ens.elevs.summit).toHaveLength(82);
    expect(ens.elevs.base).toHaveLength(82);
  });
});

describe('CPC', () => {
  it('normalizes categories', () => {
    expect(normalizeCategory('Above')).toBe('above');
    expect(normalizeCategory('Normal')).toBe('normal');
    expect(normalizeCategory('EC')).toBe('ec');
  });

  it('reads a map-service point query', () => {
    const r = parseArcPoint(fixtureJson(/cpc_6_10_day_outlk\/MapServer\/1\/query.*39\.1969/));
    expect(['above', 'below', 'normal', 'ec']).toContain(r.cat.cat);
    expect(r.valid).toMatch(/^[A-Z][a-z]{2} \d+–/);
  });

  it('treats "no polygon" as equal chances', () => {
    expect(parseArcPoint({ features: [] })).toEqual({ cat: { cat: 'ec', prob: null }, valid: null });
  });

  it('finds the week 3–4 category with point-in-polygon on the KML', () => {
    const pms = parseKml(fixtureText('wk34temp_latest.kml'));
    expect(pms.length).toBeGreaterThan(3);
    const r = kmlPoint(pms, 39.1969, -120.2357);
    expect(['above', 'below', 'normal', 'ec']).toContain(r.cat.cat);
    expect(r.valid).toMatch(/–/);
  });

  it('point-in-ring handles a simple square', () => {
    const sq: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
    expect(pointInRing(1, 1, sq)).toBe(true);
    expect(pointInRing(3, 1, sq)).toBe(false);
  });

  it('parses the ENSO advisory', () => {
    const enso = parseEnso(fixtureText('ensodisc.shtml'));
    expect(enso.status).toMatch(/El Niño|La Niña|Neutral|Watch|Advisory|Not Active/);
    expect(enso.synopsis.length).toBeGreaterThan(20);
  });
});

describe('snowpack', () => {
  it('parses SNOTEL hourly data', () => {
    const sp = parseAwdb(resort('palisades').snowpack!, fixtureJson('awdbRestApi'));
    expect(sp.station.network).toBe('SNOTEL');
    expect(sp.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(sp.series.length).toBeGreaterThan(25);
    expect(sp.change.h24).toHaveProperty('sweIn');
  });

  it('pads CDEC dates', () => {
    expect(cdecDate('2026-9-23 0:00')).toBe('2026-09-23 00:00');
    expect(cdecDate('2026-10-22 23:00')).toBe('2026-10-22 23:00');
    expect(cdecDate('garbage')).toBeNull();
  });

  it('parses CDEC and drops off-season sensor garbage', () => {
    const sp = parseCdec(resort('mammoth').snowpack!, fixtureJson('cdec.water.ca.gov'));
    expect(sp.station.network).toBe('CDEC');
    // Mammoth Pass reported about −217" depth in the recording: not a real value.
    expect(sp.depthIn === null || sp.depthIn >= 0).toBe(true);
    expect(sp.series.every((d) => d.depthIn === null || d.depthIn >= 0)).toBe(true);
  });

  it('parses CoCoRaHS via ACIS, including traces and missing days', () => {
    const today = recordedAt.toISOString().slice(0, 10);
    const sp = parseAcis(resort('bigbear').snowpack!, fixtureJson('data.rcc-acis.org'), today);
    expect(sp.station.network).toBe('CoCoRaHS');
    expect(sp.newSnow).not.toBeNull();
    expect(sp.note).toMatch(/Volunteer observer/);
    const synthetic = parseAcis(
      resort('bigbear').snowpack!,
      { data: [['2026-02-16', 'T', 'M', '0.00'], ['2026-02-17', '12.0', 'M', '1.2'], ['2026-02-18', '5.0', '24', '0.5']] },
      '2026-02-18',
    );
    expect(synthetic.newSnow).toEqual({ h24: 5, h48: 17, d7: 17 });
    expect(synthetic.depthIn).toBe(24);
  });

  it('maps ACIS ids to CoCoRaHS station numbers', () => expect(cocorahsStation('US1CASR0098')).toBe('CA-SR-98'));
});

describe('NWS', () => {
  it('splits the AFD into sections and unwraps lines', () => {
    const text = '.KEY MESSAGES...\n\n* Snow tonight\n  above 7000 ft.\n\n&&\n\n.DISCUSSION...\nA cold front\nmoves in.\n\n&&\n';
    const s = afdSections(text);
    expect([...s.keys()]).toEqual(['KEY MESSAGES', 'DISCUSSION']);
    expect(unwrap(s.get('KEY MESSAGES')!)).toBe('* Snow tonight above 7000 ft.');
    const afd = parseAfd('REV', text, '2026-10-23T09:40:00Z', 'https://example');
    expect(afd.discussion).toBe('A cold front moves in.');
  });

  it('drops forecast-discussion sentences about other parts of the region', () => {
    const afd = {
      office: 'REV',
      issuedAt: 'x',
      url: 'u',
      keyMessages: '* Dry weekend. Showers near the Oregon border Monday.\n\n* Showers in northeast CA only.',
      discussion: 'A ridge builds over the Sierra. Breezy near Pyramid Lake. Snow returns early November.',
    };
    const out = filterAfd(afd, ['Oregon border', 'northeast CA', 'Pyramid Lake']);
    expect(out.keyMessages).toBe('* Dry weekend.');
    expect(out.discussion).toBe('A ridge builds over the Sierra. Snow returns early November.');
    expect(filterAfd(afd, [])).toBe(afd);
  });

  it('parses alerts and flags winter products', () => {
    const alerts = parseAlerts({
      features: [
        { id: 'u1', properties: { id: '1', event: 'Winter Storm Warning', headline: 'WSW', severity: 'Severe', onset: null, ends: null, expires: null, description: 'Heavy snow.\nTravel very difficult.' } },
        { id: 'u2', properties: { id: '2', event: 'Lake Wind Advisory', headline: null, severity: 'Minor', onset: null, ends: null, expires: null, description: null } },
      ],
    });
    expect(alerts.map((a) => a.winter)).toEqual([true, false]);
    expect(alerts[0].description).toBe('Heavy snow. Travel very difficult.');
    expect(alerts[1].headline).toBe('Lake Wind Advisory');
  });
});

describe('avalanche.org', () => {
  it('handles the early-season summary with no ratings', () => {
    const a = parseAvalanche('ESAC', 128, fixtureJson('center_id=ESAC'));
    expect(a.zoneName).toBe('Eastside Region');
    expect(a.overall).toBe(-1);
    expect(a.overallText).toBe('No rating yet');
  });

  it('reads in-season danger by elevation band', () => {
    const a = parseAvalanche('SAC', 2458, {
      product_type: 'forecast',
      danger: [
        { lower: 1, middle: 2, upper: 3, valid_day: 'current' },
        { lower: 2, middle: 3, upper: 3, valid_day: 'tomorrow' },
      ],
      bottom_line: '<p>Wind slabs near and above treeline.</p>',
      forecast_avalanche_problems: [{ name: 'Wind Slab' }],
      forecast_zone: [{ id: 2458, name: 'Central Sierra Nevada', url: 'https://x' }],
    });
    expect(a.current).toEqual({ upper: 3, middle: 2, lower: 1 });
    expect(a.overall).toBe(3);
    expect(a.overallText).toBe('Considerable');
    expect(a.bottomLine).toBe('Wind slabs near and above treeline.');
    expect(a.problems).toEqual(['Wind Slab']);
  });
});

describe('Caltrans', () => {
  it('maps chain-control codes', () => {
    expect(normalizeChainStatus('R-0')).toBe('clear');
    expect(normalizeChainStatus('R-2')).toBe('R-2');
    expect(normalizeChainStatus('ROAD CLOSED', 'Closed to traffic.')).toBe('closed');
    expect(worse('R-1', 'closed')).toBe('closed');
    expect(worse('R-2', 'clear')).toBe('R-2');
  });

  it('matches stations to segments, including the mislabeled "I-40" records', () => {
    const stations = parseCc(fixtureJson('ccStatusD03.json'));
    const seg = resort('palisades').roads[0];
    const out = buildSegment(seg, stations, [], null);
    expect(out.stations).toBeGreaterThan(20);
    expect(stations.some((s) => s.route === 'I-40')).toBe(true);
  });

  it('reports the worst station and a closure', () => {
    const seg = resort('palisades').roads[2];
    const mk = (status: string) => ({ name: 'x', route: 'SR-89', lat: 39.2, lon: -120.2, status: normalizeChainStatus(status), rawStatus: status, description: status, since: null });
    const out = buildSegment(seg, [mk('R-0'), mk('R-2'), mk('R-1')], [], null);
    expect(out.status).toBe('R-2');
    expect(out.worst?.status).toBe('R-2');
    const closed = buildSegment(seg, [mk('R-0')], [{ route: 'SR-89', lat: 39.2, lon: -120.2, description: 'closed', start: null, end: null }], null);
    expect(closed.status).toBe('closed');
  });

  it('parses the highway-conditions text by route and area', () => {
    const t = parseRoadsText(fixtureText('roads.dot.ca.gov'));
    expect(t.asOf).toMatch(/2026/);
    expect(t.routes.size).toBeGreaterThan(0);
    for (const statements of t.routes.values()) for (const s of statements) expect(s.text).not.toMatch(/<|&nbsp;/);
  });
});

describe('MtnPowder report', () => {
  it('parses MtnPowder strings', () => {
    expect(num('12')).toBe(12);
    expect(num('--')).toBeNull();
    expect(normalizeTimestamp('2026-06-08T10:02:25-0700')).toBe('2026-06-08T10:02:25-07:00');
  });

  it('splits Palisades and Alpine out of the same feed', () => {
    const feed = fixtureJson('resortId=61');
    const pal = parseMtnpowder(resort('palisades').report!, feed as never, [], recordedAt);
    const alp = parseMtnpowder(resort('alpine').report!, feed as never, [], recordedAt);
    expect(pal.areas[0].name).toMatch(/Palisades/);
    expect(alp.areas[0].name).toMatch(/Alpine/);
    expect(pal.liftsTotal! + alp.liftsTotal!).toBe(39);
  });

  it('adds Snow Summit lifts into Big Bear and drops empty "--" stations', () => {
    const bb = resort('bigbear').report!;
    const r = parseMtnpowder(bb, fixtureJson('resortId=57') as never, [fixtureJson('resortId=58') as never], recordedAt);
    expect(r.areas.every((a) => a.name !== '--')).toBe(true);
    expect(r.liftsTotal).toBeGreaterThan(11);
  });

  it('flags old reports as not fresh', () => {
    const r = parseMtnpowder(resort('palisades').report!, fixtureJson('resortId=61') as never, [], new Date('2026-10-23T12:00:00Z'));
    expect(r.updatedAt).not.toBeNull();
    expect(r.fresh).toBe(false);
  });
});
