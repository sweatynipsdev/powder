<script lang="ts">
  // The nearest snow station: what it measures now, recent change, and the last week by day.
  import { stationDailySnow } from '../../shared/status';
  import type { SnowpackData, SourceStatus } from '../../shared/types';
  import { dayNum, fmtFt, num, signed, weekdayOf } from '../lib/display';
  import Sparkline from './charts/Sparkline.svelte';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    snowpack: SnowpackData | null;
    status: SourceStatus;
  }

  let { snowpack: s, status }: Props = $props();
  let week = $derived(stationDailySnow(s).slice(-7));
  let weekMax = $derived(Math.max(2, ...week.map((d) => d.inches ?? 0)));
  let depths = $derived(s ? s.series.map((d) => d.depthIn ?? d.sweIn) : []);
</script>

<section class="card station">
  <div class="head">
    <div>
      <a href={s?.station.url} target="_blank" rel="noopener" class="name">{s?.station.name ?? 'Snow station'}</a>
      {#if s}<span class="small accent">{s.station.network} Station · {fmtFt(s.station.elevFt)} ft</span>{/if}
    </div>
    <StaleChip {status} hasData={!!s} />
  </div>
  {#if s}
    <div class="stats">
      <div><span class="small muted">Depth</span><strong>{s.depthIn === null ? '—' : `${num(s.depthIn, 0)}"`}</strong></div>
      <div><span class="small muted">Snow water</span><strong>{s.sweIn === null ? '—' : `${num(s.sweIn)}"`}</strong></div>
      <div><span class="small muted">24h</span><strong>{signed(s.newSnow?.h24 ?? s.change.h24.depthIn ?? s.change.h24.sweIn)}"</strong></div>
      <div><span class="small muted">7 days</span><strong>{signed(s.newSnow?.d7 ?? s.change.d7.depthIn ?? s.change.d7.sweIn)}"</strong></div>
    </div>

    <div class="week" aria-label="New snow by day, last 7 days">
      {#each week as d (d.date)}
        <div class="day">
          <div class="track">
            {#if (d.inches ?? 0) >= 0.5}<span class="v">{num(d.inches, 0)}"</span>{/if}
            <div class="bar" style:height="{((d.inches ?? 0) / weekMax) * 44}px"></div>
          </div>
          <span class="small">{weekdayOf(d.date)[0]}</span>
          <span class="small muted">{dayNum(d.date)}</span>
        </div>
      {/each}
    </div>
    <p class="small muted">
      {s.newSnow ? 'New snow measured by a volunteer observer.' : 'New snow estimated from depth gains, which undercount as snow settles.'}
      {s.note ?? ''}
    </p>
    {#if depths.some((v) => v !== null)}
      <div class="spark">
        <Sparkline values={depths} label="Snow depth, last 30 days" width={200} />
        <span class="small muted">depth, 30 days</span>
      </div>
    {/if}
  {/if}
</section>

<style>
  .station {
    display: grid;
    gap: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .head div {
    display: grid;
  }
  .name {
    font-size: 20px;
    font-weight: 800;
  }
  .accent {
    color: var(--accent);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .stats div {
    display: grid;
  }
  .stats strong {
    font-size: 20px;
  }
  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .day {
    display: grid;
    justify-items: center;
  }
  .track {
    height: 60px;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    border-bottom: 1px solid var(--axis);
  }
  .bar {
    width: 18px;
    border-radius: 3px 3px 0 0;
    background: color-mix(in srgb, var(--snow) 60%, var(--muted));
  }
  .v {
    font-size: 11px;
    font-weight: 700;
  }
  p {
    margin: 0;
  }
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
</style>
