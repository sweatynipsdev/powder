<script lang="ts">
  import type { ReportData, SourceStatus } from '../../shared/types';
  import { clockTime, num, timeAgo } from '../lib/display';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    report: ReportData | null;
    status: SourceStatus;
    website: string | null;
  }

  let { report: r, status, website }: Props = $props();
</script>

<section class="card" aria-labelledby="report">
  <div class="head">
    <h2 id="report">Resort report</h2>
    <StaleChip {status} hasData={!!r} />
  </div>
  {#if r}
    {#if !r.fresh}
      <p class="small"><span class="status neutral"><span class="dot"></span>Not current</span> Last updated {timeAgo(r.updatedAt)}, so these numbers aren't today's.</p>
    {:else}
      <p class="small muted">Updated {clockTime(r.updatedAt)}{r.conditions ? ` · ${r.conditions}` : ''}</p>
    {/if}
    <div class="stats" class:dim={!r.fresh}>
      <div><span class="small muted">New 24h</span><strong>{r.h24 === null ? '—' : `${num(r.h24, 0)}"`}</strong></div>
      <div><span class="small muted">New 48h</span><strong>{r.h48 === null ? '—' : `${num(r.h48, 0)}"`}</strong></div>
      <div><span class="small muted">Base depth</span><strong>{r.baseDepthIn === null ? '—' : `${num(r.baseDepthIn, 0)}"`}</strong></div>
      <div><span class="small muted">Lifts open</span><strong>{r.liftsTotal ? `${r.liftsOpen}/${r.liftsTotal}` : '—'}</strong></div>
    </div>
    {#if r.areas.length > 1}
      <table class="data">
        <thead><tr><th scope="col">Station</th><th scope="col">24h</th><th scope="col">48h</th><th scope="col">7 days</th><th scope="col">Base</th></tr></thead>
        <tbody>
          {#each r.areas as a (a.name)}
            <tr>
              <td>{a.name}</td>
              <td>{a.h24 ?? '—'}</td>
              <td>{a.h48 ?? '—'}</td>
              <td>{a.d7 ?? '—'}</td>
              <td>{a.baseDepthIn ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if r.seasonTotalIn !== null}<p class="small muted">Season total {num(r.seasonTotalIn, 0)}"</p>{/if}
  {/if}
  {#if website}<p class="small"><a href={website} target="_blank" rel="noopener">Resort website ↗</a></p>{/if}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  p {
    margin: 6px 0 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 10px 0;
  }
  .stats div {
    display: grid;
  }
  .stats strong {
    font-size: 20px;
    font-weight: 650;
  }
  .stats.dim strong {
    color: var(--text-secondary);
  }
</style>
