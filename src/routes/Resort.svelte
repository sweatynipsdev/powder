<script lang="ts">
  import type { ResortData } from '../../shared/types';
  import AlertsBanner from '../components/AlertsBanner.svelte';
  import AnalysisPanel from '../components/AnalysisPanel.svelte';
  import AvalanchePanel from '../components/AvalanchePanel.svelte';
  import CamsPanel from '../components/CamsPanel.svelte';
  import ModelPlume from '../components/charts/ModelPlume.svelte';
  import SnowChart from '../components/charts/SnowChart.svelte';
  import WeatherCharts from '../components/charts/WeatherCharts.svelte';
  import CpcStrip from '../components/CpcStrip.svelte';
  import ElevationToggle from '../components/ElevationToggle.svelte';
  import FiveDay from '../components/FiveDay.svelte';
  import NwsPanel from '../components/NwsPanel.svelte';
  import ReportPanel from '../components/ReportPanel.svelte';
  import RoadsPanel from '../components/RoadsPanel.svelte';
  import SnowpackPanel from '../components/SnowpackPanel.svelte';
  import SourcesNote from '../components/SourcesNote.svelte';
  import StaleChip from '../components/StaleChip.svelte';
  import Totals from '../components/Totals.svelte';
  import { fmtFt } from '../lib/display';
  import { prefs } from '../lib/prefs.svelte';

  interface Props {
    resort: ResortData;
  }

  let { resort: r }: Props = $props();
  let f = $derived(r.forecast.data);

  const SECTIONS = [
    ['analysis', 'Analysis'],
    ['forecast', 'Forecast'],
    ['outlook', 'Outlook'],
    ['observed', 'Snowpack'],
    ['drive', 'Roads'],
    ['more', 'More'],
  ] as const;
</script>

<div class="stack">
  <header>
    <h1>{r.name}</h1>
    <p class="small muted">{r.region} · base {fmtFt(r.baseFt)} ft · summit {fmtFt(r.summitFt)} ft</p>
  </header>

  <nav class="jump" aria-label="Sections">
    <ElevationToggle />
    {#each SECTIONS as [id, label] (id)}
      <a class="chip small" href={`#/r/${r.id}`} onclick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>{label}</a>
    {/each}
  </nav>

  <AlertsBanner alerts={r.alerts.data ?? []} detailed={r.alerts.data ?? []} />

  <div id="analysis"><AnalysisPanel analysis={r.analysis} /></div>

  <div id="forecast" class="stack">
    {#if f}
      <div class="row">
        <h2>Forecast · {prefs.elevation === 'summit' ? `summit ${fmtFt(r.summitFt)} ft` : `base ${fmtFt(r.baseFt)} ft`}</h2>
        <StaleChip status={r.forecast.status} hasData={!!f} />
      </div>
      <Totals forecast={f} elevation={prefs.elevation} />
      <FiveDay forecast={f} elevation={prefs.elevation} />
      <SnowChart days={f.days} periods={f.periods} elevation={prefs.elevation} />
      <!-- Older cached data (from before running totals were added) has no `cumulative`. -->
      {#if f.cumulative?.length}<ModelPlume forecast={f} elevation={prefs.elevation} />{/if}
      <WeatherCharts periods={f.periods} baseFt={r.baseFt} summitFt={r.summitFt} />
    {:else}
      <div class="card"><h2>Forecast</h2><p class="muted">Model data is unavailable right now.</p></div>
    {/if}
  </div>

  <div id="outlook"><CpcStrip cpc={r.cpc.data} status={r.cpc.status} /></div>

  <div id="observed" class="stack">
    {#if r.snowpack}<SnowpackPanel snowpack={r.snowpack.data} status={r.snowpack.status} />{/if}
    {#if r.report}<ReportPanel report={r.report.data} status={r.report.status} website={r.links.website} />{/if}
    {#if r.avalanche}<AvalanchePanel avalanche={r.avalanche.data} status={r.avalanche.status} />{/if}
  </div>

  <div id="drive">
    {#if r.roads}<RoadsPanel roads={r.roads.data} status={r.roads.status} cams={r.links.roadCams} />{/if}
  </div>

  <div id="more" class="stack">
    <CamsPanel links={r.links} />
    <NwsPanel nws={r.nws.data} afd={r.afd.data} />
    <SourcesNote resort={r} />
  </div>
</div>

<style>
  .stack {
    display: grid;
    /* minmax(0, 1fr): sideways-scrolling children scroll inside their card instead of widening the page. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  header h1 {
    font-size: 26px;
  }
  header p {
    margin: 2px 0 0;
  }
  .jump {
    position: sticky;
    top: calc(env(safe-area-inset-top) + 52px);
    z-index: 5;
    display: flex;
    gap: 6px;
    align-items: center;
    overflow-x: auto;
    padding: 8px 0;
    margin: 0 -16px;
    padding-inline: 16px;
    background: color-mix(in srgb, var(--page) 92%, transparent);
    backdrop-filter: blur(8px);
    scrollbar-width: none;
  }
  .chip {
    flex: none;
    text-decoration: none;
    padding: 4px 11px;
    border-radius: 999px;
    background: var(--surface-1);
    border: 1px solid var(--hairline);
    color: var(--text-secondary);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  [id] {
    scroll-margin-top: 110px;
  }
</style>
