<script lang="ts">
  import type { Last24, ReportData, ResortStatus } from '../../shared/types';
  import { clockTime, num } from '../lib/display';

  interface Props {
    report: ReportData | null;
    last24: Last24;
    status: ResortStatus;
    tz: string;
  }

  let { report: r, last24, status, tz }: Props = $props();
</script>

<section class="card recent">
  <div class="grid">
    <div class="main">
      <strong class="big">{last24.inches === null ? '—' : `${num(last24.inches, 0)}"`}</strong>
      <span class="u">Last 24 Hours</span>
    </div>
    <div class="side">
      <div><strong>{r?.fresh && r.h48 !== null ? `${num(r.h48, 0)}"` : '—'}</strong><span class="u">Last 48 Hours</span></div>
      <div><strong>{r?.fresh && r.d7 !== null ? `${num(r.d7, 0)}"` : '—'}</strong><span class="u">Last 7 Days</span></div>
      <div><strong>{r?.baseDepthIn !== null && r?.baseDepthIn !== undefined ? `${num(r.baseDepthIn, 0)}"` : '—'}</strong><span class="u">Base Depth</span></div>
    </div>
  </div>
  <p>Resort Status: <strong class="state {status.state}">{status.text}</strong></p>
  <p class="small">
    {#if last24.source === 'reported'}
      <span class="badge reported">Reported</span> by the resort at {clockTime(last24.at, tz)}
    {:else if last24.source === 'estimated'}
      <span class="badge">Estimated</span> from the snow station; the resort report isn't current
    {:else}
      <span class="badge">No data</span>
    {/if}
  </p>
  {#if r?.seasonTotalIn !== null && r?.seasonTotalIn !== undefined}
    <p class="small muted">Season total {num(r.seasonTotalIn, 0)}" (resort-reported{r.fresh ? '' : ', last season or stale'})</p>
  {/if}
</section>

<style>
  .recent {
    display: grid;
    gap: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    align-items: center;
  }
  .main {
    display: grid;
    justify-items: center;
    border-right: 1px solid var(--hairline);
  }
  .big {
    font-size: 44px;
    font-weight: 900;
  }
  .side {
    display: grid;
    gap: 6px;
    padding-left: 18px;
  }
  .side div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .side strong {
    font-size: 22px;
    min-width: 44px;
  }
  .u {
    font-size: 14px;
    color: var(--text-2);
    border-bottom: 2px solid var(--estimated);
  }
  p {
    margin: 0;
  }
  .state.closed,
  .state.not-open {
    color: var(--closed);
  }
  .state.open {
    color: var(--open);
  }
  .badge.reported {
    color: var(--open);
  }
</style>
