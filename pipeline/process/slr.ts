// Snow from liquid precipitation, using the air temperature at that elevation.
// Open-Meteo's own `snowfall` assumes a fixed ~7:1 ratio, which undercounts cold storms.

/** [temperature °F, snow-to-liquid ratio]; linearly interpolated, clamped at the ends. */
export const SLR_TABLE: ReadonlyArray<readonly [number, number]> = [
  [34, 6],
  [32, 8],
  [28, 10],
  [22, 12],
  [15, 14],
  [5, 17],
];

/** All snow at or below this temperature (°F). */
export const ALL_SNOW_F = 32;
/** All rain at or above this temperature (°F). */
export const ALL_RAIN_F = 35;

export function snowRatio(tempF: number): number {
  const t = SLR_TABLE;
  if (tempF >= t[0][0]) return t[0][1];
  if (tempF <= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [t0, r0] = t[i];
    const [t1, r1] = t[i + 1];
    if (tempF <= t0 && tempF >= t1) return r0 + ((t0 - tempF) / (t0 - t1)) * (r1 - r0);
  }
  return t[t.length - 1][1];
}

/** Share of precipitation falling as snow: 1 at ≤32°F, 0 at ≥35°F, linear between. */
export function snowFraction(tempF: number): number {
  if (tempF <= ALL_SNOW_F) return 1;
  if (tempF >= ALL_RAIN_F) return 0;
  return (ALL_RAIN_F - tempF) / (ALL_RAIN_F - ALL_SNOW_F);
}

/** Inches of snow from inches of liquid at a temperature. */
export function snowFromPrecip(precipIn: number, tempF: number): number {
  if (precipIn <= 0) return 0;
  return precipIn * snowFraction(tempF) * snowRatio(tempF);
}

/** Inches of liquid falling as rain. */
export function rainFromPrecip(precipIn: number, tempF: number): number {
  if (precipIn <= 0) return 0;
  return precipIn * (1 - snowFraction(tempF));
}
