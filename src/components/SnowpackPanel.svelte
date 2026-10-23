<script lang="ts">
  import type { SnowpackData, SourceStatus } from '../../shared/types';
  import { fmtFt, num, signed, timeAgo } from '../lib/display';
  import Sparkline from './charts/Sparkline.svelte';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    snowpack: SnowpackData | null;
    status: SourceStatus;
  }

  let { snowpack: s, status }: Props = $props();
  let series = $derived(s ? s.series.map((d) => d.depthIn ?? d.sweIn) : []);
  let seriesLabel = $derived(s && s.series.some((d) => d.depthIn !== null) ? 'snow depth' : 'snow water');
  // SNOTEL and CDEC stamp observations in Pacific Standard Time all year (no DST).
  const PST = '-08:00';
</script>

<section class="card" aria-labelledby="snowpack">
  <div class="head">
    <h2 id="snowpack">Observed snowpack</h2>
    <StaleChip {status} hasData={!!s} />
  </div>
  {#if s}
    <p class="small muted">
      <a href={s.station.url} target="_blank" rel="noopener">{s.station.name}</a> · {s.station.network} · {fmtFt(s.station.elevFt)} ft ·
      {timeAgo(s.observedAt ? `${s.observedAt}:00${PST}` : null)}
    </p>
    <div class="stats">
      <div><span class="small muted">Depth</span><strong>{s.depthIn === null ? '—' : `${num(s.depthIn, 0)}"`}</strong></div>
      <div><span class="small muted">Snow water</span><strong>{s.sweIn === null ? '—' : `${num(s.sweIn)}"`}</strong></div>
      {#if s.newSnow}
        <div><span class="small muted">New 24h</span><strong>{s.newSnow.h24 === null ? '—' : `${num(s.newSnow.h24)}"`}</strong></div>
        <div><span class="small muted">New 7 days</span><strong>{s.newSnow.d7 === null ? '—' : `${num(s.newSnow.d7)}"`}</strong></div>
      {:else}
        <div><span class="small muted">24h change</span><strong>{signed(s.change.h24.depthIn ?? s.change.h24.sweIn)}"</strong></div>
        <div><span class="small muted">7-day change</span><strong>{signed(s.change.d7.depthIn ?? s.change.d7.sweIn)}"</strong></div>
      {/if}
    </div>
    {#if series.some((v) => v !== null)}
      <div class="spark">
        <Sparkline values={series} label={`${seriesLabel}, last 30 days`} width={220} />
        <span class="small muted">{seriesLabel}, 30 days</span>
      </div>
    {/if}
    {#if s.note}<p class="small muted">{s.note}</p>{/if}
  {:else if !status.ok}
    <p class="muted">Station data unavailable.</p>
  {/if}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  p {
    margin: 4px 0 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }
  .stats div {
    display: grid;
  }
  .stats strong {
    font-size: 20px;
    font-weight: 650;
  }
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    margin-top: 10px;
  }
</style>
