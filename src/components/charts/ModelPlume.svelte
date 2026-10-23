<script lang="ts">
  // Running snowfall totals by model: where the models agree or split is obvious from how
  // the lines fan out. The band is the middle half of the ensemble members' totals.
  import { scaleLinear, scalePoint } from 'd3-scale';
  import { area, curveMonotoneX, line } from 'd3-shape';
  import type { Elev, ForecastData, ModelId, SnowAmount } from '../../../shared/types';
  import { fmtDay, fmtSnow, fmtSnowRange } from '../../lib/display';
  import ChartFrame from './ChartFrame.svelte';
  import { keyIndex, nearestIndex, pointerX } from './interact';
  import Tooltip, { type TipRow } from './Tooltip.svelte';

  interface Props {
    forecast: ForecastData;
    elevation: Elev;
  }

  let { forecast, elevation }: Props = $props();

  type SeriesId = 'blend' | ModelId;
  // Fixed slot order; blue is "our blend" everywhere in the app.
  const SERIES: { id: SeriesId; label: string; color: string }[] = [
    { id: 'blend', label: 'Blend', color: 'var(--series-1)' },
    { id: 'gfs', label: 'GFS', color: 'var(--series-2)' },
    { id: 'ecmwf', label: 'ECMWF', color: 'var(--series-3)' },
    { id: 'icon', label: 'ICON', color: 'var(--series-4)' },
    { id: 'gem', label: 'GEM', color: 'var(--series-5)' },
  ];

  const H = 210;
  const M = { top: 12, right: 74, bottom: 26, left: 30 };
  const LABEL_GAP = 13;

  let width = $state(340);
  let active = $state<number | null>(null);

  let points = $derived(forecast.cumulative.map((c) => c[elevation]));
  const valueOf = (a: SnowAmount, id: SeriesId) => (id === 'blend' ? a.blend : (a.models[id] ?? null));

  let series = $derived(
    SERIES.map((s) => ({ ...s, values: points.map((p) => valueOf(p, s.id)) })).filter((s) => s.values.some((v) => v !== null)),
  );
  let x = $derived(
    scalePoint<number>()
      .domain(points.map((_, i) => i))
      .range([M.left, width - M.right]),
  );
  let yMax = $derived(
    Math.max(3, ...points.flatMap((p) => [p.range?.hi ?? 0, p.blend ?? 0, ...Object.values(p.models).map((v) => v ?? 0)])),
  );
  let y = $derived(scaleLinear().domain([0, yMax]).nice(4).range([H - M.bottom, M.top]));
  let xs = $derived(points.map((_, i) => x(i)!));

  let bandPath = $derived(
    area<SnowAmount>()
      .defined((p) => p.range !== null && p.rangeSource === 'ensemble')
      .x((_, i) => xs[i])
      .y0((p) => y(p.range!.lo))
      .y1((p) => y(p.range!.hi))
      .curve(curveMonotoneX)(points) ?? '',
  );

  const pathFor = (values: (number | null)[]) =>
    line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => xs[i])
      .y((v) => y(v!))
      .curve(curveMonotoneX)(values) ?? '';

  /** End labels in the right gutter, nudged apart and tied to their line ends by leaders. */
  let ends = $derived.by(() => {
    const raw = series
      .map((s) => {
        const last = s.values.findLastIndex((v) => v !== null);
        return { ...s, last, value: s.values[last]!, ex: xs[last], ey: y(s.values[last]!) };
      })
      .sort((a, b) => a.ey - b.ey);
    // Push overlapping labels down, then pull back up so none fall below the plot.
    const ly: number[] = [];
    raw.forEach((e, i) => (ly[i] = Math.max(e.ey, i ? ly[i - 1] + LABEL_GAP : -Infinity)));
    for (let i = raw.length - 1; i >= 0; i--) ly[i] = Math.min(ly[i], i < raw.length - 1 ? ly[i + 1] - LABEL_GAP : H - M.bottom);
    return raw.map((e, i) => ({ ...e, ly: ly[i] }));
  });

  function tipRows(i: number): TipRow[] {
    const p = points[i];
    const rows: TipRow[] = series
      .filter((s) => s.values[i] !== null)
      .map((s) => ({ label: s.label, value: `${fmtSnow(s.values[i])}"`, color: s.color }));
    if (p.range && p.rangeSource === 'ensemble') rows.push({ label: 'ensemble middle 50%', value: `${fmtSnowRange(p.range)}"` });
    return rows;
  }

  const valueText = (i: number) =>
    `Through ${fmtDay(forecast.cumulative[i].date)}: ` +
    series
      .filter((s) => s.values[i] !== null)
      .map((s) => `${s.label} ${fmtSnow(s.values[i])} inches`)
      .join(', ');

  let table = $derived({
    columns: ['Through', ...series.map((s) => s.label), 'Ensemble 50%'],
    rows: points.map((p, i) => [
      fmtDay(forecast.cumulative[i].date),
      ...series.map((s) => fmtSnow(s.values[i])),
      p.range && p.rangeSource === 'ensemble' ? fmtSnowRange(p.range) : '—',
    ]),
  });

  let legend = $derived([
    ...series.map((s) => ({ label: s.label, color: s.color, kind: 'line' as const })),
    { label: 'Ensemble middle 50%', color: 'var(--wash-1)', kind: 'band' as const },
  ]);
</script>

<ChartFrame
  title="Models: running total"
  subtitle={`${elevation === 'summit' ? 'Summit' : 'Base'} inches, added up day by day. Lines stop where a model's forecast ends.`}
  {legend}
  {table}
>
  <div
    class="wrap"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label="Running snowfall totals by model"
    aria-valuemin={0}
    aria-valuemax={points.length - 1}
    aria-valuenow={active ?? 0}
    aria-valuetext={valueText(active ?? 0)}
    onpointermove={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onpointerdown={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onclick={(e) => (active = nearestIndex(xs, pointerX(e)))}
    onpointerleave={(e) => { if (e.pointerType === 'mouse') active = null; }}
    onblur={() => (active = null)}
    onkeydown={(e) => {
      const i = keyIndex(e, active, points.length);
      if (i !== null) {
        active = i;
        e.preventDefault();
      }
    }}
  >
    <svg {width} height={H} aria-hidden="true">
      {#each y.ticks(4) as t (t)}
        <line class="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
        <text class="tick" x={M.left - 6} y={y(t)} dy="0.32em" text-anchor="end">{t}"</text>
      {/each}
      <line class="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />

      <path class="band" d={bandPath} />

      {#if active !== null}
        <line class="crosshair" x1={xs[active]} x2={xs[active]} y1={M.top} y2={H - M.bottom} />
      {/if}

      {#each [...series].reverse() as s (s.id)}
        <path class="line" class:blend={s.id === 'blend'} d={pathFor(s.values)} stroke={s.color} />
      {/each}

      {#each ends as e (e.id)}
        <circle class="dot" cx={e.ex} cy={e.ey} r="4" fill={e.color} />
        <line class="leader" x1={e.ex + 5} x2={width - M.right + 6} y1={e.ey} y2={e.ly} />
        <line x1={width - M.right + 8} x2={width - M.right + 16} y1={e.ly} y2={e.ly} stroke={e.color} stroke-width="2" stroke-linecap="round" />
        <text class="end" x={width - M.right + 20} y={e.ly} dy="0.32em">{e.label} {fmtSnow(e.value)}"</text>
      {/each}

      {#if active !== null}
        {#each series as s (s.id)}
          {#if s.values[active] !== null}
            <circle class="dot" cx={xs[active]} cy={y(s.values[active]!)} r="4" fill={s.color} />
          {/if}
        {/each}
      {/if}

      {#each points as _, i (i)}
        {#if i % 3 === 0 || i === points.length - 1}
          <text class="tick" x={xs[i]} y={H - M.bottom + 15} text-anchor="middle">{fmtDay(forecast.cumulative[i].date).slice(0, 3)}</text>
        {/if}
      {/each}
    </svg>
    {#if active !== null}
      <Tooltip x={xs[active]} {width} title={`Through ${fmtDay(forecast.cumulative[active].date)}`} rows={tipRows(active)} />
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
  .grid {
    stroke: var(--grid);
  }
  .baseline {
    stroke: var(--axis);
  }
  .tick {
    fill: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .band {
    fill: var(--wash-1);
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .line.blend {
    stroke-width: 2.5;
  }
  .dot {
    stroke: var(--surface-1);
    stroke-width: 2;
  }
  .leader {
    stroke: var(--axis);
    stroke-width: 1;
  }
  .end {
    fill: var(--text-secondary);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .crosshair {
    stroke: var(--text-muted);
    stroke-width: 1;
  }
</style>
