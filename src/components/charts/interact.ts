// Index-based hover/focus shared by every chart: the pointer (or arrow keys) picks the
// nearest x position, so readers aim at a day, never at a 2px line.

export function nearestIndex(xs: number[], px: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
  return best;
}

export function pointerX(e: MouseEvent): number {
  const rect = (e.currentTarget as Element).getBoundingClientRect();
  return e.clientX - rect.left;
}

/** Arrow-key navigation; returns the new index or null if the key isn't handled. */
export function keyIndex(e: KeyboardEvent, current: number | null, count: number): number | null {
  if (e.key === 'ArrowRight') return Math.min(count - 1, (current ?? -1) + 1);
  if (e.key === 'ArrowLeft') return Math.max(0, (current ?? count) - 1);
  if (e.key === 'Home') return 0;
  if (e.key === 'End') return count - 1;
  return null;
}

/** SVG path for a column with a 4px rounded data-end and a square baseline. */
export function columnPath(x: number, y: number, w: number, baseline: number, r = 4): string {
  const h = baseline - y;
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${baseline}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${baseline}Z`;
}
