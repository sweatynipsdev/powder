<script lang="ts">
  import type { ResortSummary } from '../../shared/types';
  import { avalancheTone, fmtSnow, fmtSnowRange, ROAD_STATUS } from '../lib/display';
  import { prefs } from '../lib/prefs.svelte';
  import { resortHref } from '../lib/router.svelte';
  import MiniBars from './MiniBars.svelte';

  interface Props {
    resort: ResortSummary;
  }

  let { resort: r }: Props = $props();
  let e = $derived(prefs.elevation);
  let next5 = $derived(r.buckets?.d1_5[e] ?? null);
  let next10 = $derived(r.buckets?.d6_10[e] ?? null);
  let road = $derived(r.roads && r.roads !== 'clear' && r.roads !== 'unknown' ? ROAD_STATUS[r.roads] : null);
  let winter = $derived(r.alerts.filter((a) => a.winter));
  const rangeOf = (a: typeof next5) => (a?.range && fmtSnowRange(a.range) !== fmtSnow(a.blend) ? `${fmtSnowRange(a.range)}"` : '');
</script>

<a class="card fav" href={resortHref(r.id)}>
  <div class="status {r.status.state}">
    <span class="dot"></span>{r.status.text}
  </div>
  <div class="name">
    <h2>{r.name}</h2>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </div>

  <div class="stats">
    <div class="stat last">
      <span class="label">Last 24 Hours</span>
      <span class="val">{r.last24.inches === null ? '—' : `${fmtSnow(r.last24.inches)}"`}</span>
      {#if r.last24.source === 'estimated'}<span class="badge">Estimated</span>{:else if r.last24.source === 'reported'}<span class="small muted">Reported</span>{/if}
    </div>
    <div class="stat">
      <span class="label">Next 1–5 Days</span>
      <span class="val">{fmtSnow(next5?.blend)}"</span>
      <span class="small muted tabular">{rangeOf(next5)}</span>
    </div>
    <div class="stat">
      <span class="label">Next 6–10 Days</span>
      <span class="val outlook">{fmtSnow(next10?.blend)}"</span>
      <span class="small muted tabular">{rangeOf(next10)}</span>
    </div>
  </div>

  {#if r.days.length}
    <MiniBars days={r.days.map((d) => ({ date: d.date, inches: d[e] }))} />
  {/if}

  {#if r.headline}<p class="headline">{r.headline}</p>{/if}

  {#if winter.length || road || (r.avalanche && r.avalanche.overall > 0) || r.staleSources.length}
    <div class="chips">
      {#each winter as a (a.headline)}
        <span class="status-pill critical"><span class="d"></span>{a.event}</span>
      {/each}
      {#if road}<span class="status-pill {road.tone}"><span class="d"></span>Roads: {road.label}</span>{/if}
      {#if r.avalanche && r.avalanche.overall > 0}
        <span class="status-pill {avalancheTone(r.avalanche.overall)}"><span class="d"></span>Avalanche: {r.avalanche.text}</span>
      {/if}
      {#if r.staleSources.length}<span class="status-pill warning"><span class="d"></span>{r.staleSources.length} stale</span>{/if}
    </div>
  {/if}
</a>

<style>
  .fav {
    display: grid;
    gap: 10px;
    color: inherit;
  }
  .fav:active {
    background: var(--card-2);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }
  .status .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--muted);
    box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
  }
  .status.open {
    color: var(--open);
  }
  .status.open .dot {
    background: var(--open);
  }
  .status.closed,
  .status.not-open {
    color: var(--closed);
  }
  .status.closed .dot,
  .status.not-open .dot {
    background: var(--closed);
  }
  .name {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: -4px;
    color: var(--muted);
  }
  h2 {
    font-size: 23px;
    font-weight: 800;
    color: var(--text);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .stat {
    display: grid;
    justify-items: start;
    align-content: start;
    gap: 1px;
  }
  .stat.last {
    background: var(--card-2);
    border-radius: 10px;
    padding: 6px 10px;
    margin: -6px 0 -6px -6px;
  }
  .label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-2);
  }
  .val {
    font-size: 30px;
    font-weight: 800;
    line-height: 1.1;
  }
  .val.outlook {
    color: var(--outlook);
  }
  .headline {
    margin: 0;
    font-weight: 600;
    color: var(--text-2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 9px 2px 7px;
    border-radius: 999px;
    background: var(--card-2);
    color: var(--text-2);
  }
  .status-pill .d {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
  }
  .status-pill.critical .d {
    background: var(--critical);
  }
  .status-pill.serious .d {
    background: var(--serious);
  }
  .status-pill.warning .d {
    background: var(--warning);
  }
  .status-pill.good .d {
    background: var(--good);
  }
</style>
