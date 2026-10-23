<script lang="ts">
  // 10-day snow strip for a favorites row: one column per day, orange for big days,
  // weekend days in bold. Each column carries its value as a native tooltip.
  import { BIG_DAY_IN, dayNum, fmtSnow, isWeekend, weekdayOf } from '../lib/display';

  interface Props {
    days: { date: string; inches: number | null }[];
  }

  let { days }: Props = $props();
  const H = 36;
  let max = $derived(Math.max(4, ...days.map((d) => d.inches ?? 0)));
</script>

<div class="bars" role="img" aria-label={`Next ${days.length} days: ${days.map((d) => `${weekdayOf(d.date)} ${fmtSnow(d.inches)} inches`).join(', ')}`}>
  {#each days as d (d.date)}
    {@const v = d.inches ?? 0}
    <div class="day" title={`${weekdayOf(d.date)} ${dayNum(d.date)}: ${fmtSnow(d.inches)}"`}>
      <div class="track" style:height="{H}px">
        {#if v >= 0.5}<span class="v small">{fmtSnow(v)}</span>{/if}
        <div class="bar" class:big={v >= BIG_DAY_IN} style:height="{Math.max(v > 0.04 ? 2 : 0, (v / max) * (H - 12))}px"></div>
      </div>
      <span class="dow" class:weekend={isWeekend(d.date)}>{weekdayOf(d.date)[0]}</span>
    </div>
  {/each}
</div>

<style>
  .bars {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 4px;
  }
  .day {
    display: grid;
    justify-items: center;
    gap: 3px;
  }
  .track {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    border-bottom: 1px solid var(--axis);
  }
  .bar {
    width: 60%;
    max-width: 16px;
    border-radius: 3px 3px 0 0;
    background: var(--snow);
  }
  .bar.big {
    background: var(--snow-big);
  }
  .v {
    font-size: 10px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.1;
  }
  .dow {
    font-size: 11px;
    color: var(--muted);
  }
  .dow.weekend {
    color: var(--text);
    font-weight: 800;
  }
</style>
