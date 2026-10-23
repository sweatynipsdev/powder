<script lang="ts">
  import { last24 as last24Of, resortOpenStatus, stationDailySnow } from '../../shared/status';
  import type { ResortData, ResortSummary } from '../../shared/types';
  import AlertsBanner from '../components/AlertsBanner.svelte';
  import AvalanchePanel from '../components/AvalanchePanel.svelte';
  import CamsCarousel from '../components/CamsCarousel.svelte';
  import ModelPlume from '../components/charts/ModelPlume.svelte';
  import WeatherCharts from '../components/charts/WeatherCharts.svelte';
  import CpcStrip from '../components/CpcStrip.svelte';
  import DailyTable from '../components/DailyTable.svelte';
  import ElevationToggle from '../components/ElevationToggle.svelte';
  import ExpertCard from '../components/ExpertCard.svelte';
  import ForecastPost from '../components/ForecastPost.svelte';
  import HourlyTable from '../components/HourlyTable.svelte';
  import LocalNotes from '../components/LocalNotes.svelte';
  import NwsPanel from '../components/NwsPanel.svelte';
  import RecentSnow from '../components/RecentSnow.svelte';
  import RightNow from '../components/RightNow.svelte';
  import RoadsPanel from '../components/RoadsPanel.svelte';
  import SnowTimeline from '../components/SnowTimeline.svelte';
  import SourcesNote from '../components/SourcesNote.svelte';
  import StarButton from '../components/StarButton.svelte';
  import StaleChip from '../components/StaleChip.svelte';
  import StationCard from '../components/StationCard.svelte';
  import { prefs } from '../lib/prefs.svelte';
  import { resortHref, type ResortTab } from '../lib/router.svelte';

  interface Props {
    resort: ResortData;
    tab: ResortTab;
    summary: ResortSummary | null;
  }

  let { resort: r, tab, summary }: Props = $props();
  let f = $derived(r.forecast.data);
  let e = $derived(prefs.elevation);
  let status = $derived(summary?.status ?? resortOpenStatus(r.report?.data, new Date(), r.openingDate));
  let last24 = $derived(summary?.last24 ?? last24Of(r.report?.data, r.snowpack?.data));
  // Days before today; today's partial day is "Last 24 Hours".
  let observed = $derived(stationDailySnow(r.snowpack?.data).slice(0, -1));
  let expert = $derived(r.expert?.data ?? null);
  let expertInitials = $derived(
    expert
      ? (expert.author ?? expert.source)
          .replace(/^the /i, '')
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '',
  );

  const TABS: { id: ResortTab; label: string }[] = [
    { id: 'weather', label: 'Weather' },
    { id: 'summary', label: 'Snow Summary' },
    { id: 'report', label: 'Snow Report' },
    { id: 'forecast', label: 'Forecast' },
  ];
</script>

{#snippet expertCard()}
  {#if expert}
    <ExpertCard
      author={expert.author ?? expert.source}
      role={`Local forecaster · ${expert.source}`}
      avatar={{ initials: expertInitials }}
      at={expert.publishedAt}
      title={expert.title}
      text={expert.excerpt}
      href={expert.url}
      external
    />
  {/if}
{/snippet}

<div class="stack">
  <header class="rhead">
    <div class="status {status.state}"><span class="dot"></span>{status.text}</div>
    <div class="title">
      <h1>{r.name}</h1>
      <StarButton id={r.id} name={r.name} />
    </div>
    <div class="point">
      <span class="small muted">Forecast Point</span>
      <ElevationToggle summitFt={r.summitFt} baseFt={r.baseFt} />
    </div>
    <nav class="tabs hscroll" aria-label="Resort sections">
      {#each TABS as t (t.id)}
        <a href={resortHref(r.id, t.id)} class:on={tab === t.id} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
      {/each}
    </nav>
  </header>

  <AlertsBanner alerts={r.alerts.data ?? []} detailed={r.alerts.data ?? []} />

  {#if tab === 'summary'}
    <div class="row">
      <h2 class="section-title">Snow Summary</h2>
      {#if f}<span class="small muted">{f.models.length} models + {f.ensembles.reduce((s, x) => s + x.members, 0)} ensemble runs</span>{/if}
    </div>
    {#if f}
      <SnowTimeline forecast={f} elevation={e} {observed} {last24} tz={r.tz} />
    {:else}
      <div class="card"><StaleChip status={r.forecast.status} hasData={false} /> Model data is unavailable right now.</div>
    {/if}

    <CamsCarousel cams={[...r.links.cams, ...r.links.roadCams]} more={r.links.webcams} />

    <h2 class="section-title">Local Expert</h2>
    {#if r.analysis}
      <ExpertCard
        author="Powder Forecast"
        role={`AI forecaster · ${r.analysis.model}`}
        avatar={{ src: './favicon.svg' }}
        at={r.analysis.generatedAt}
        title={r.analysis.headline}
        text={r.analysis.summary ?? r.analysis.next5Days}
        href={resortHref(r.id, 'forecast')}
      />
    {/if}
    {@render expertCard()}

    {#if f?.cumulative?.length}
      <h2 class="section-title">Model Comparison</h2>
      <ModelPlume forecast={f} elevation={e} />
    {/if}

    <h2 class="section-title">Long-Range Outlook</h2>
    <CpcStrip cpc={r.cpc.data} status={r.cpc.status} />
  {:else if tab === 'weather'}
    {#if f}
      <h2 class="section-title">Right Now</h2>
      <RightNow forecast={f} elevation={e} station={r.snowpack?.data ?? null} />
      <h2 class="section-title">Hourly Forecast</h2>
      <HourlyTable hourly={f.hourly} elevation={e} />
      <h2 class="section-title">Daily Forecast</h2>
      <DailyTable forecast={f} elevation={e} />
      <WeatherCharts periods={f.periods} baseFt={r.baseFt} summitFt={r.summitFt} />
    {:else}
      <div class="card">Model data is unavailable right now.</div>
    {/if}
    <h2 class="section-title">National Weather Service</h2>
    <NwsPanel nws={r.nws.data} afd={r.afd.data} />
  {:else if tab === 'report'}
    {#if r.links.report ?? r.links.website}
      <a class="card sitelink" href={r.links.report ?? r.links.website} target="_blank" rel="noopener">View the report on the resort website →</a>
    {/if}
    <h2 class="section-title">Recent Snow</h2>
    <p class="section-sub">Resort-reported when current, otherwise estimated from the nearest snow station.</p>
    <RecentSnow report={r.report?.data ?? null} {last24} {status} tz={r.tz} />
    {#if r.snowpack}
      <h2 class="section-title">Live Snow</h2>
      <p class="section-sub">The nearest snow station, usually updated hourly.</p>
      <StationCard snowpack={r.snowpack.data} status={r.snowpack.status} />
    {/if}
    {#if r.avalanche}
      <h2 class="section-title">Avalanche Forecast</h2>
      <AvalanchePanel avalanche={r.avalanche.data} status={r.avalanche.status} />
    {/if}
    {#if r.roads}
      <h2 class="section-title">Getting There</h2>
      <RoadsPanel roads={r.roads.data} status={r.roads.status} cams={[]} />
    {:else if r.links.roads}
      <h2 class="section-title">Getting There</h2>
      <a class="card sitelink" href={r.links.roads} target="_blank" rel="noopener">Road conditions for the drive →</a>
    {/if}
    <LocalNotes notes={r.localNotes ?? []} />
    <SourcesNote resort={r} />
  {:else}
    <ForecastPost resort={r} />
    {@render expertCard()}
  {/if}
</div>

<style>
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  .rhead {
    display: grid;
    gap: 8px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 17px;
    font-weight: 600;
    color: var(--muted);
  }
  .status .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 22%, transparent);
  }
  .status.closed,
  .status.not-open {
    color: var(--closed);
  }
  .status.open {
    color: var(--open);
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h1 {
    font-size: 34px;
  }
  .point {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin: 4px -16px 0;
    padding: 0 16px;
    border-bottom: 1px solid var(--hairline);
  }
  .tabs a {
    flex: none;
    padding: 10px 12px 9px;
    font-size: 17px;
    font-weight: 600;
    color: var(--muted);
    border-bottom: 3px solid transparent;
  }
  .tabs a.on {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row .section-title {
    margin-bottom: 0;
  }
  .stack > :global(.section-title) {
    margin-bottom: -4px;
  }
  .sitelink {
    text-align: center;
    font-weight: 700;
    font-size: 17px;
  }
</style>
