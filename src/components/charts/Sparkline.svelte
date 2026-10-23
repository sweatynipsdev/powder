<script lang="ts">
  // A trend line in the de-emphasis ink with the latest value as an accent dot.
  import { scaleLinear } from 'd3-scale';
  import { line } from 'd3-shape';

  interface Props {
    values: (number | null)[];
    label: string;
    width?: number;
    height?: number;
  }

  let { values, label, width = 140, height = 36 }: Props = $props();

  let x = $derived(scaleLinear().domain([0, Math.max(1, values.length - 1)]).range([4, width - 4]));
  let y = $derived.by(() => {
    const v = values.filter((n): n is number => n !== null);
    const max = Math.max(1, ...v);
    return scaleLinear().domain([0, max]).range([height - 4, 4]);
  });
  let d = $derived(
    line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y((v) => y(v!))(values) ?? '',
  );
  let last = $derived(values.findLastIndex((v) => v !== null));
</script>

<svg {width} {height} role="img" aria-label={label}>
  <line x1="4" x2={width - 4} y1={y(0)} y2={y(0)} class="base" />
  <path {d} class="line" />
  {#if last >= 0}
    <circle cx={x(last)} cy={y(values[last]!)} r="4" class="dot" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    overflow: visible;
  }
  .base {
    stroke: var(--axis);
  }
  .line {
    fill: none;
    stroke: var(--text-muted);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .dot {
    fill: var(--series-1);
    stroke: var(--surface-1);
    stroke-width: 2;
  }
</style>
