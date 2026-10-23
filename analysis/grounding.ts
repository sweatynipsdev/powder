// Checks that every unit-tagged number in a write-up appears in the brief with the same
// kind of unit. "18 inches" must match a snow number; it doesn't pass just because 18 is
// somewhere in the brief as a temperature. Day counts, weekdays and "the next 5 days"
// carry no unit and aren't checked.

export type Unit = 'in' | 'F' | 'ft' | 'mph' | 'pct';

const NUM = String.raw`\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?`;
const NUMBER = new RegExp(NUM, 'g');

/** A number or "A-B" / "A to B" range followed by a unit; the range takes the unit. */
const CLAIM = new RegExp(
  String.raw`(?<![\w.])(${NUM})(?:\s*(?:-|–|—|to)\s*(${NUM}))?\s*` +
    String.raw`("|″|''|-?inch(?:es)?\b|in\.(?=\s)|°\s*F?|degrees?\b|-?f(?:ee|oo)?t\b|ft\b\.?|mph\b|miles per hour|%|percent\b)`,
  'gi',
);

const toNumber = (s: string) => Number(s.replace(/,/g, ''));

function unitOf(token: string): Unit {
  const t = token.toLowerCase();
  if (/^("|″|''|-?inch|in\.)/.test(t)) return 'in';
  if (/^(°|degree)/.test(t)) return 'F';
  if (/^(-?f(ee|oo)t|ft)/.test(t)) return 'ft';
  if (/^(mph|miles)/.test(t)) return 'mph';
  return 'pct';
}

export interface Claim {
  raw: string;
  unit: Unit;
  values: number[];
}

export function extractClaims(text: string): Claim[] {
  return [...text.matchAll(CLAIM)].map((m) => ({
    raw: m[0].trim(),
    unit: unitOf(m[3]),
    values: [m[1], m[2]].filter((v): v is string => !!v).map(toNumber),
  }));
}

export function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER)].map((m) => toNumber(m[0]));
}

// --- what the brief allows --------------------------------------------------------

export type Allowed = Record<Unit | 'any', number[]>;

/** Fields written by people (NWS, avalanche center, Caltrans): their numbers count for any unit. */
const FREE_TEXT = /^(nwsDiscussion|nwsForecast|avalanche|alerts|notes|enso|localKnowledge|localExpert)$/;

/** Unit implied by a field name, for values the brief stores without a unit. */
function unitOfKey(key: string, parent: string | undefined): Unit | null {
  if (/Ft$/.test(key)) return 'ft';
  if (/TempF$/.test(key)) return 'F';
  if (/Mph$/.test(key)) return 'mph';
  if (parent === 'models') return 'in';
  if (/(Snow|In|daytime|overnight|total|wetScenario|summit|base|last24h|last48h|last7d)$/i.test(key)) return 'in';
  return null;
}

export function allowedNumbers(briefJson: string): Allowed {
  const allowed: Allowed = { in: [], F: [], ft: [], mph: [], pct: [], any: [] };
  const walk = (node: unknown, path: string[]) => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
      return;
    }
    const text = String(node);
    const keys = path.filter((k) => !/^\d+$/.test(k));
    const [key, parent] = [keys.at(-1) ?? '', keys.at(-2)];
    for (const c of extractClaims(text)) allowed[c.unit].push(...c.values);
    if (keys.some((k) => FREE_TEXT.test(k))) allowed.any.push(...numbersIn(text));
    const unit = unitOfKey(key, parent);
    if (unit) allowed[unit].push(...numbersIn(text));
  };
  walk(JSON.parse(briefJson), []);
  return allowed;
}

/**
 * Rounding is fine ("around 7,000 feet" for 7,200; "about 3 inches" for 2.6), so a claimed
 * value may sit within half a unit, or 5% for big numbers like elevations.
 */
export function isGrounded(value: number, candidates: number[]): boolean {
  return candidates.some((a) => Math.abs(value - a) <= Math.max(0.5, Math.abs(a) * 0.05));
}

/**
 * Signs the write-up is talking about its input instead of the weather: "the brief",
 * "JSON", or a field name like wetScenario or days6to10Summit.
 */
export function metaReferences(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/\b(the brief|brief's|JSON|the data provided|the provided data)\b/gi)) found.add(m[1].toLowerCase());
    for (const m of t.matchAll(/\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/g)) found.add(m[0]);
  }
  return [...found];
}

/** "6 (0-10) inches" → "0-10 inches": the brief's best-then-range shorthand reads badly in prose. */
export function tidyAmounts(text: string): string {
  return text.replace(/(?<![\w.])(?:<1|\d+) \((\d+-\d+)\)/g, '$1');
}

export function findUngrounded(texts: string[], briefJson: string): string[] {
  const allowed = allowedNumbers(briefJson);
  const bad = new Set<string>();
  for (const text of texts)
    for (const claim of extractClaims(text)) {
      const pool = [...allowed[claim.unit], ...allowed.any];
      if (!claim.values.every((v) => isGrounded(v, pool))) bad.add(claim.raw);
    }
  return [...bad];
}
