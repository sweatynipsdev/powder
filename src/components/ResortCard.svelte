<script lang="ts">
  import type { ResortSummary, SnowAmount } from '../../shared/types';
  import { avalancheTone, fmtSnow, fmtSnowRange, ROAD_STATUS, timeAgo } from '../lib/display';
  import { prefs } from '../lib/prefs.svelte';
  import { resortHref } from '../lib/router.svelte';
  import SnowStrip from './charts/SnowStrip.svelte';

  interface Props {
    resort: ResortSummary;
  }

  let { resort: r }: Props = $props();

  let windows = $derived(
    r.windows
      ? [
          { label: 'Next 24h', a: r.windows.next24h[prefs.elevation] },
          { label: 'Next 72h', a: r.windows.next72h[prefs.elevation] },
          { label: 'Next 7 days', a: r.windows.next7d[prefs.elevation] },
        ]
      : [],
  );
  // "0" next to a 0" estimate says nothing; show the range only when it adds something.
  const rangeText = (a: SnowAmount) => {
    const range = fmtSnowRange(a.range);
    return a.range && range !== fmtSnow(a.blend) ? `${range}"` : '';
  };
  let road = $derived(r.roads ? ROAD_STATUS[r.roads] : null);
  let winterAlerts = $derived(r.alerts.filter((a) => a.winter));
</script>

<a class="card resort" href={resortHref(r.id)}>
  <header>
    <div>
      <h2>{r.name}</h2>
      <p class="small muted">{r.region} · {r.summitFt.toLocaleString()} ft summit</p>
    </div>
    {#if r.reported}
      <div class="reported small">
        {#if r.reported.fresh}
          <strong>{fmtSnow(r.reported.h24)}"</strong> <span class="muted">reported 24h</span>
        {:else}
          <span class="muted">No current report</span>
        {/if}
      </div>
    {/if}
  </header>

  {#if r.headline}<p class="headline">{r.headline}</p>{/if}

  <div class="windows">
    {#each windows as w (w.label)}
      <div class="stat">
        <span class="small muted">{w.label}</span>
        <span class="value">{fmtSnow(w.a.blend)}"</span>
        <span class="small secondary tabular">{rangeText(w.a)}</span>
      </div>
    {/each}
  </div>

  {#if r.strip.length}
    <div class="strip">
      <SnowStrip strip={r.strip} />
      <span class="small muted">10 days, day / night</span>
    </div>
  {/if}

  <div class="chips">
    {#each winterAlerts as a (a.headline)}
      <span class="status {/warning/i.test(a.event) ? 'critical' : 'serious'}"><span class="dot"></span>{a.event}</span>
    {/each}
    {#if road}
      <span class="status {road.tone}"><span class="dot"></span>Roads: {road.label}</span>
    {/if}
    {#if r.avalanche && r.avalanche.overall > 0}
      <span class="status {avalancheTone(r.avalanche.overall)}"><span class="dot"></span>Avalanche: {r.avalanche.text}</span>
    {/if}
    {#if r.staleSources.length}
      <span class="status warning"><span class="dot"></span>{r.staleSources.length} stale source{r.staleSources.length > 1 ? 's' : ''}</span>
    {/if}
  </div>
  {#if r.reported && !r.reported.fresh && r.reported.updatedAt}
    <p class="small muted foot">Resort report last updated {timeAgo(r.reported.updatedAt)}</p>
  {/if}
</a>

<style>
  .resort {
    display: grid;
    gap: 12px;
    text-decoration: none;
  }
  .resort:active {
    background: var(--surface-2);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  header p {
    margin: 2px 0 0;
  }
  .reported {
    text-align: right;
    flex: none;
  }
  .headline {
    margin: 0;
    font-weight: 600;
    color: var(--text-primary);
  }
  .windows {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .stat {
    display: grid;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 8px 10px;
  }
  .value {
    font-size: 26px;
    font-weight: 650;
    line-height: 1.15;
  }
  .strip {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips:empty {
    display: none;
  }
  .foot {
    margin: -4px 0 0;
  }
</style>
