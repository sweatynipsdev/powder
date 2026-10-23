<script lang="ts">
  // 16-day snowfall: one column per day (the blend), a whisker for the likely range, and a
  // divider where the forecast turns into a trend. Day/night split lives in the tooltip,
  // the table, and the 5-day grid.
  import { scaleBand, scaleLinear } from 'd3-scale';
  import type { DaySummary, Elev, Period } from '../../../shared/types';
  import { fmtDay, fmtFt, fmtSnow, fmtSnowRange } from '../../lib/display';
  import ChartFrame from './ChartFrame.svelte';
  import { columnPath, keyIndex, nearestIndex, pointerX } from './interact';
  import Tooltip, { type TipRow } from './Tooltip.svelte';

  interface Props {
    days: DaySummary[];
    periods: Period[];
    elevation: Elev;
  }

  let { days, periods, elevation }: Props = $props();

  const H = 190;
  const M = { top: 20, right: 6, bottom: 34, left: 26 };
  const NEAR_DAYS = 5;

  let width = $state(340);
  let active = $state<number | null>(null);

  let amounts = $derived(days.map((d) => d.snow[elevation]));
  let x = $derived(
    scaleBand<number>()
      .domain(days.map((_, i) => i))
      .range([M.left, width - M.right])
      .paddingInner(0.28),
  );
  let colW = $derived(Math.min(24, x.bandwidth()));
  let yMax = $derived(Math.max(3, ...amounts.map((a) => Math.max(a.blend ?? 0, a.range?.hi ?? 0))));
  let y = $derived(scaleLinear().domain([0, yMax]).nice(4).range([H - M.bottom, M.top]));
  let centers = $derived(days.map((_, i) => x(i)! + x.bandwidth() / 2));
  // Label only the standout days, never every column.
  let labeled = $derived(
    new Set(
      amounts
        .map((a, i) => ({ i, v: a.blend ?? 0 }))
        .filter((d) => d.v >= 1)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
        .map((d) => d.i),
    ),
  );
  let showDate = $derived(x.bandwidth() >= 15);

  function tipRows(i: number): TipRow[] {
    const a = amounts[i];
    const [day, night] = [periods[2 * i], periods[2 * i + 1]];
    const rows: TipRow[] = [
      { label: 'best estimate', value: `${fmtSnow(a.blend)}"`, color: 'var(--series-1)' },
      { label: 'likely range', value: `${fmtSnowRange(a.range)}"` },
      { label: 'daytime', value: `${fmtSnow(day?.snow[elevation].blend)}"` },
      { label: 'overnight', value: `${fmtSnow(night?.snow[elevation].blend)}"` },
    ];
    if (days[i].confidence) rows.push({ label: 'confidence', value: days[i].confidence! });
    const sl = days[i].snowLevelFt;
    if (sl.min !== null) rows.push({ label: 'snow level', value: `${fmtFt(sl.min)}–${fmtFt(sl.max)} ft` });
    return rows;
  }

  const valueText = (i: number) =>
    `${fmtDay(days[i].date)}: ${fmtSnow(amounts[i].blend)} inches, likely ${fmtSnowRange(amounts[i].range)}`;

  let table = $derived({
    columns: ['Day', 'Daytime', 'Overnight', 'Total', 'Likely range', 'Confidence'],
    rows: days.map((d, i) => [
      fmtDay(d.date),
      fmtSnow(periods[2 * i]?.snow[elevation].blend),
      fmtSnow(periods[2 * i + 1]?.snow[elevation].blend),
      fmtSnow(d.snow[elevation].blend),
      fmtSnowRange(d.snow[elevation].range),
      d.confidence ?? '—',
    ]),
  });
</script>

<ChartFrame
  title="Snowfall, next 16 days"
  subtitle={`${elevation === 'summit' ? 'Summit' : 'Base'}, inches per day (5am–5am).`}
  legend={[
    { label: 'Best estimate', color: 'var(--series-1)', kind: 'rect' },
    { label: 'Likely range', color: 'var(--wash-1)', kind: 'band' },
  ]}
  {table}
>
  <!-- Keyboard and screen readers step through days like a slider; the table view has everything. -->
  <div
    class="wrap"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label="Daily snowfall forecast"
    aria-valuemin={0}
    aria-valuemax={days.length - 1}
    aria-valuenow={active ?? 0}
    aria-valuetext={valueText(active ?? 0)}
    onpointermove={(e) => (active = nearestIndex(centers, pointerX(e)))}
    onpointerdown={(e) => (active = nearestIndex(centers, pointerX(e)))}
    onclick={(e) => (active = nearestIndex(centers, pointerX(e)))}
    onpointerleave={(e) => { if (e.pointerType === 'mouse') active = null; }}
    onblur={() => (active = null)}
    onkeydown={(e) => {
      const i = keyIndex(e, active, days.length);
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

      <!-- Where the forecast becomes a trend -->
      {#if days.length > NEAR_DAYS}
        {@const dx = x(NEAR_DAYS)! - (x.step() - x.bandwidth()) / 2}
        <line class="divider" x1={dx} x2={dx} y1={M.top - 12} y2={H - M.bottom} />
        <text class="note" x={dx + 4} y={M.top - 6}>trend →</text>
      {/if}

      {#if active !== null}
        <rect class="hover" x={x(active)! - 2} y={M.top - 4} width={x.bandwidth() + 4} height={H - M.bottom - M.top + 4} rx="4" />
      {/if}

      {#each amounts as a, i (i)}
        {@const cx = centers[i]}
        <!-- Likely range as a wash behind the column: "could be up to this". -->
        {#if a.range && a.range.hi - a.range.lo >= 0.5}
          <path class="range" d={columnPath(cx - colW / 2 - 3, y(a.range.hi), colW + 6, y(a.range.lo))} />
        {/if}
        {#if a.blend !== null && a.blend > 0.04}
          <path class="col" d={columnPath(cx - colW / 2, y(a.blend), colW, y(0))} />
        {/if}
        {#if labeled.has(i)}
          <text class="value" x={cx} y={y(Math.max(a.blend ?? 0, a.range?.hi ?? 0)) - 5} text-anchor="middle">{fmtSnow(a.blend)}"</text>
        {/if}
      {/each}

      <line class="baseline" x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} />

      {#each days as d, i (d.date)}
        <text class="tick" class:today={i === 0} x={centers[i]} y={H - M.bottom + 14} text-anchor="middle">{fmtDay(d.date)[0]}</text>
        {#if showDate || i % 2 === 0}
          <text class="tick date" x={centers[i]} y={H - M.bottom + 27} text-anchor="middle">{Number(d.date.slice(8))}</text>
        {/if}
      {/each}
    </svg>
    {#if active !== null}
      <Tooltip x={centers[active]} {width} title={fmtDay(days[active].date)} rows={tipRows(active)} />
    {/if}
  </div>
</ChartFrame>

<style>
  .wrap {
    position: relative;
    margin-top: 8px;
    touch-action: pan-y;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .baseline {
    stroke: var(--axis);
    stroke-width: 1;
  }
  .divider {
    stroke: var(--axis);
    stroke-width: 1;
  }
  .tick,
  .note {
    fill: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .tick.today {
    fill: var(--text-primary);
    font-weight: 700;
  }
  .tick.date {
    font-size: 10px;
  }
  .col {
    fill: var(--series-1);
  }
  .range {
    fill: var(--wash-1);
  }
  .value {
    fill: var(--text-primary);
    font-size: 11px;
    font-weight: 600;
  }
  .hover {
    fill: var(--surface-2);
  }
</style>
