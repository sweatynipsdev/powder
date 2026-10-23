<script lang="ts">
  import type { ResortData, SourceKey, SourceStatus } from '../../shared/types';
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
    roads: 'Caltrans',
    report: 'Resort report',
  };

  let rows = $derived(
    (Object.keys(LABELS) as SourceKey[])
      .map((k) => ({ k, s: r[k]?.status as SourceStatus | undefined }))
      .filter((x): x is { k: SourceKey; s: SourceStatus } => !!x.s),
  );
</script>

<footer class="card small">
  <p>Updated <strong>{clockTime(r.generatedAt, r.tz)}</strong> ({timeAgo(r.generatedAt)}). Data refreshes about 5am and 4pm Pacific.</p>
  <ul>
    {#each rows as { k, s } (k)}
      <li>
        <span class="status {s.ok ? 'good' : s.stale ? 'warning' : 'critical'}"><span class="dot"></span>{s.ok ? 'ok' : s.stale ? 'stale' : 'down'}</span>
        <span class="secondary">{LABELS[k]}</span>
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
