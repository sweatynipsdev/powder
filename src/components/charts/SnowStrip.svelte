<script lang="ts">
  // Home-card sparkline: day/night snowfall for the next 10 days, one series, no axes.
  // Each bar carries its value in a <title>; the resort page has the full chart and table.
  import { scaleLinear } from 'd3-scale';
  import type { ResortSummary } from '../../../shared/types';
  import { fmtSnow } from '../../lib/display';
  import { columnPath } from './interact';

  interface Props {
    strip: ResortSummary['strip'];
  }

  let { strip }: Props = $props();

  const H = 40;
  const BAR = 5;
  const GAP = 2;
  const DAY_GAP = 4;

  let width = $derived(strip.reduce((w, s, i) => w + BAR + (i === 0 ? 0 : s.kind === 'day' ? DAY_GAP : GAP), 0));
  let y = $derived(scaleLinear().domain([0, Math.max(4, ...strip.map((s) => s.snowIn ?? 0))]).range([H - 10, 2]));
  let xs = $derived(
    strip.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + BAR + (s.kind === 'day' ? DAY_GAP : GAP)], []),
  );
</script>

<svg {width} height={H} role="img" aria-label="Snowfall by day and night, next 10 days">
  <line x1="0" x2={width} y1={H - 10} y2={H - 10} class="base" />
  {#each strip as s, i (i)}
    <g>
      <title>{s.label}: {fmtSnow(s.snowIn)}"</title>
      {#if (s.snowIn ?? 0) > 0.04}
        <path d={columnPath(xs[i], y(s.snowIn!), BAR, H - 10, 2)} class="bar" />
      {/if}
      <rect x={xs[i]} y="0" width={BAR} height={H - 10} fill="transparent" />
    </g>
    {#if s.kind === 'day' && i % 4 === 0}
      <text x={xs[i] + BAR} y={H - 1} text-anchor="middle">{s.label.slice(0, 1)}</text>
    {/if}
  {/each}
</svg>

<style>
  svg {
    display: block;
    overflow: visible;
  }
  .bar {
    fill: var(--series-1);
  }
  .base {
    stroke: var(--axis);
  }
  text {
    fill: var(--text-muted);
    font-size: 9px;
  }
</style>
