<script lang="ts">
  import type { ResortData, SourceKey, SourceStatus } from '../../shared/types';
  import { refreshCaption } from '../../shared/schedule';
  import { clockTime, timeAgo } from '../lib/display';

  interface Props {
    resort: ResortData;
  }

  let { resort: r }: Props = $props();

  const LABELS: Record<SourceKey, string> = {
    forecast: 'Models (Open-Meteo)',
    cpc: 'CPC outlooks',
    snowpack: 'Snowpack station',
    nws: 'NWS forecast',
    alerts: 'NWS alerts',
    afd: 'NWS discussion',
    avalanche: 'avalanche.org',
    roads: 'Roads',
    report: 'Resort report',
    expert: 'Local expert',
  };

  // Road data cached before WSDOT was added has no agencies: it was all Caltrans.
  const label = (k: SourceKey) =>
    k === 'roads' && r.roads?.data ? (r.roads.data.agencies ?? ['Caltrans']).join(' + ') : LABELS[k];

  let rows = $derived(
    (Object.keys(LABELS) as SourceKey[])
      .map((k) => ({ k, s: r[k]?.status as SourceStatus | undefined }))
      .filter((x): x is { k: SourceKey; s: SourceStatus } => !!x.s),
  );
</script>

<footer class="card small">
  <p>Updated <strong>{clockTime(r.generatedAt, r.tz)}</strong> ({timeAgo(r.generatedAt)}). Data refreshes {refreshCaption(r.tz, new Date())}.</p>
  <ul>
    {#each rows as { k, s } (k)}
      <li>
        <span class="status {s.ok ? 'good' : s.stale ? 'warning' : 'critical'}"><span class="dot"></span>{s.ok ? 'ok' : s.stale ? 'stale' : 'down'}</span>
        <span class="secondary">{label(k)}</span>
        {#if !s.ok}<span class="muted">{s.stale ? `using data from ${timeAgo(s.fetchedAt)}` : (s.error ?? '')}</span>{/if}
      </li>
    {/each}
  </ul>
</footer>

<style>
  p {
    margin: 0 0 8px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 4px;
  }
  li {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
</style>
