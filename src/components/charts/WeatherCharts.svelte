<script lang="ts">
  // Temperature, snow level and wind as small multiples on one shared time axis. They're
  // different units, so they never share a y-axis; one crosshair reads all three.
  import { scaleLinear, scalePoint } from 'd3-scale';
  import { curveMonotoneX, line } from 'd3-shape';
  import type { Period } from '../../../shared/types';
  import { fmtFt, periodTime } from '../../lib/display';
  import ChartFrame from './ChartFrame.svelte';
  import { columnPath, keyIndex, nearestIndex, pointerX } from './interact';
  import Tooltip, { type TipRow } from './Tooltip.svelte';

  interface Props {
    periods: Period[];
    baseFt: number;
    summitFt: number;
  }

  let { periods: allPeriods, baseFt, summitFt }: Props = $props();

  const DAYS = 10;
  const M = { left: 40, right: 8 };
  const PANEL_H = 112;
  const PAD = { top: 18, bottom: 8 };
  const AXIS_H = 22;
  const FREEZING = 32;

  let width = $state(340);
  let active = $state<number | null>(null);

  let periods = $derived(allPeriods.slice(0, DAYS * 2));
  // Highs by day, lows at night: the swing a skier feels.
  const temp = (p: Period, e: 'summit' | 'base') => (p.kind === 'day' ? p.tempF[e].max : p.tempF[e].min);
  let summitT = $derived(periods.map((p) => temp(p, 'summit')));
  let baseT = $derived(periods.map((p) => temp(p, 'base')));
  let snowLevel = $derived(periods.map((p) => p.snowLevelFt));
  let gusts = $derived(periods.map((p) => p.gustMph));

  let x = $derived(
    scalePoint<number>()
      .domain(periods.map((_, i) => i))
      .range([M.left, width - M.right])
      .padding(0.5),
  );
  let xs = $derived(periods.map((_, i) => x(i)!));
  const finite = (vals: (number | null)[]) => vals.filter((v): v is number => v !== null);

  const panelY = (k: number) => k * PANEL_H;
  const yRange = (k: number): [number, number] => [panelY(k) + PANEL_H - PAD.bottom, panelY(k) + PAD.top];

  let yT = $derived.by(() => {
    const v = finite([...summitT, ...baseT, FREEZING]);
    return scaleLinear().domain([Math.min(...v) - 3, Math.max(...v) + 3]).nice(4).range(yRange(0));
  });
  let yS = $derived.by(() => {
    const v = finite([...snowLevel, baseFt, summitFt]);
    return scaleLinear().domain([Math.min(...v) - 500, Math.max(...v) + 500]).nice(4).range(yRange(1));
  });
  let yW = $derived(scaleLinear().domain([0, Math.max(30, ...finite(gusts))]).nice(3).range(yRange(2)));

  const path = (vals: (number | null)[], y: (v: number) => number) =>
    line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => xs[i])
      .y((v) => y(v!))
      .curve(curveMonotoneX)(vals) ?? '';

  let H = $derived(PANEL_H * 3 + AXIS_H);
  let colW = $derived(Math.max(3, Math.min(8, x.step() * 0.5)));

  function tipRows(i: number): TipRow[] {
    const p = periods[i];
    const rows: TipRow[] = [
      { label: 'summit', value: summitT[i] === null ? '—' : `${summitT[i]}°F`, color: 'var(--series-1)' },
      { label: 'base', value: baseT[i] === null ? '—' : `${baseT[i]}°F`, color: 'var(--series-2)' },
      { label: 'snow level', value: snowLevel[i] === null ? '—' : `${fmtFt(snowLevel[i])} ft` },
      { label: 'gusts', value: gusts[i] === null ? '—' : `${gusts[i]} mph` },
    ];
    if (p.rainAtBase) rows.push({ label: 'at the base', value: 'rain' });
    return rows;
  }

  const valueText = (i: number) => `${periods[i].label}: ${tipRows(i).map((r) => `${r.label} ${r.value}`).join(', ')}`;

  let table = $derived({
    columns: ['Period', 'Summit °F', 'Base °F', 'Snow level ft', 'Gusts mph'],
    rows: periods.map((p, i) => [p.label, summitT[i] ?? '—', baseT[i] ?? '—', fmtFt(snowLevel[i]), gusts[i] ?? '—']),
  });

  const legend = [
    { label: 'Summit', color: 'var(--series-1)', kind: 'line' as const },
    { label: 'Base', color: 'var(--series-2)', kind: 'line' as const },
  ];
</script>

<ChartFrame title="Temperature, snow level & wind" subtitle="Next 10 days: highs by day, lows at night. Brighter line at 32°F." {legend} {table}>
  <div
    class="wrap"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label="Temperature, snow level and wind gusts"
    aria-valuemin={0}
    aria-valuemax={periods.length - 1}
    aria-valuenow={active ?? 0}
    aria-valuetext={valueText(active ?? 0)}
    onpointermove={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onpointerdown={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onclick={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onpointerleave={(e) => { if (e.pointerType === 'mouse') active = null; }}
    onblur={() => (active = null)}
    onkeydown={(e) => {
      const i = keyIndex(e, active, periods.length);
      if (i !== null) {
        active = i;
        e.preventDefault();
      }
    }}
  >
    <svg {width} height={H} aria-hidden="true">
      <!-- Temperature -->
      <text class="panel" x={M.left} y={panelY(0) + 10}>Temperature °F</text>
      {#each yT.ticks(3) as t (t)}
        <line class="grid" x1={M.left} x2={width - M.right} y1={yT(t)} y2={yT(t)} />
        <text class="tick" x={M.left - 6} y={yT(t)} dy="0.32em" text-anchor="end">{t}°</text>
      {/each}
      <line class="ref" x1={M.left} x2={width - M.right} y1={yT(FREEZING)} y2={yT(FREEZING)} />
      <path class="line" d={path(baseT, yT)} stroke="var(--series-2)" />
      <path class="line" d={path(summitT, yT)} stroke="var(--series-1)" />

      <!-- Snow level against the mountain; labels live in the title so they never sit on the line. -->
      <text class="panel" x={M.left} y={panelY(1) + 10}>Snow level ft <tspan class="sub">· shaded: base {fmtFt(baseFt)} to summit {fmtFt(summitFt)}</tspan></text>
      <rect class="mountain" x={M.left} width={width - M.left - M.right} y={yS(summitFt)} height={yS(baseFt) - yS(summitFt)} />
      {#each yS.ticks(3) as t (t)}
        <text class="tick" x={M.left - 6} y={yS(t)} dy="0.32em" text-anchor="end">{t >= 1000 ? `${t / 1000}k` : t}</text>
      {/each}
      <path class="line" d={path(snowLevel, yS)} stroke="var(--series-1)" />

      <!-- Wind gusts -->
      <text class="panel" x={M.left} y={panelY(2) + 10}>Gusts mph</text>
      {#each yW.ticks(3) as t (t)}
        <line class="grid" x1={M.left} x2={width - M.right} y1={yW(t)} y2={yW(t)} />
        <text class="tick" x={M.left - 6} y={yW(t)} dy="0.32em" text-anchor="end">{t}</text>
      {/each}
      {#each gusts as g, i (i)}
        {#if g !== null}
          <path class="col" d={columnPath(xs[i] - colW / 2, yW(g), colW, yW(0), 2)} />
        {/if}
      {/each}
      <line class="baseline" x1={M.left} x2={width - M.right} y1={yW(0)} y2={yW(0)} />

      {#if active !== null}
        <line class="crosshair" x1={xs[active]} x2={xs[active]} y1={0} y2={PANEL_H * 3} />
        {#if summitT[active] !== null}<circle class="dot" cx={xs[active]} cy={yT(summitT[active]!)} r="4" fill="var(--series-1)" />{/if}
        {#if baseT[active] !== null}<circle class="dot" cx={xs[active]} cy={yT(baseT[active]!)} r="4" fill="var(--series-2)" />{/if}
        {#if snowLevel[active] !== null}<circle class="dot" cx={xs[active]} cy={yS(snowLevel[active]!)} r="4" fill="var(--series-1)" />{/if}
      {/if}

      <!-- Shared day axis -->
      {#each periods as p, i (i)}
        {#if p.kind === 'day' && i % 4 === 0}
          <text class="tick" x={xs[i]} y={PANEL_H * 3 + 14} text-anchor="middle">{p.label}</text>
        {/if}
      {/each}
    </svg>
    {#if active !== null}
      <Tooltip x={xs[active]} {width} title={`${periods[active].label} (${periodTime(periods[active].start)}–${periodTime(periods[active].end).split(' ')[1]})`} rows={tipRows(active)} />
    {/if}
  </div>
</ChartFrame>

<style>
  .wrap {
    position: relative;
    margin-top: 6px;
    touch-action: pan-y;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .panel {
    fill: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
  }
  .grid {
    stroke: var(--grid);
  }
  .baseline {
    stroke: var(--axis);
  }
  .ref {
    stroke: var(--text-muted);
  }
  .sub {
    fill: var(--text-muted);
    font-weight: 400;
  }
  .tick {
    fill: var(--text-muted);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .mountain {
    fill: var(--band-neutral);
  }
  .col {
    fill: var(--series-1);
  }
  .dot {
    stroke: var(--surface-1);
    stroke-width: 2;
  }
  .crosshair {
    stroke: var(--text-muted);
    stroke-width: 1;
  }
</style>
