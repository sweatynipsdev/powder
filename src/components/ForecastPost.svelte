<script lang="ts">
  import type { ResortData } from '../../shared/types';
  import { timeAgo } from '../lib/display';

  interface Props {
    resort: ResortData;
  }

  let { resort: r }: Props = $props();
  let a = $derived(r.analysis);
  const TONE = { high: 'good', medium: 'warning', low: 'serious' } as const;

  let sources = $derived(
    [
      r.forecast.data ? `${r.forecast.data.models.length} forecast models and ${r.forecast.data.ensembles.reduce((s, e) => s + e.members, 0)} ensemble runs` : null,
      r.afd.data ? `NWS ${r.afd.data.office} forecast discussion` : null,
      r.expert?.data ? `${r.expert.data.author ?? r.expert.data.source}'s local forecast` : null,
      r.avalanche?.data ? `${r.avalanche.data.center} avalanche forecast` : null,
      r.snowpack?.data ? `${r.snowpack.data.station.name} observations` : null,
      r.localNotes?.length ? 'local knowledge notes' : null,
    ].filter(Boolean),
  );

  const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
</script>

<article class="card post">
  {#if a}
    <header>
      <img src="./favicon.svg" alt="" class="avatar" />
      <div>
        <strong>By Powder AI</strong>
        <span class="muted">Posted {timeAgo(a.generatedAt)}</span>
        <span class="muted">{date(a.generatedAt)}</span>
      </div>
    </header>
    <h2 class="title">{a.headline}</h2>

    <h3>Summary</h3>
    <p>{a.summary ?? a.next5Days.split(/\n\n+/)[0]}</p>

    <h3>Short Term Forecast</h3>
    {#each a.next5Days.split(/\n\n+/) as para, i (i)}<p>{para}</p>{/each}

    <h3>Extended Forecast</h3>
    <p>{a.extended6to16}</p>

    <h3>Model Agreement <span class="status {TONE[a.modelAgreement.confidence]}"><span class="dot"></span>{a.modelAgreement.confidence} confidence</span></h3>
    <p>{a.modelAgreement.summary}</p>

    <h3>What to Watch</h3>
    <p>{a.whatToWatch}</p>

    {#if a.ungrounded.length}
      <p class="warn small">⚠ Contains numbers not found in the forecast data: {a.ungrounded.join(', ')}</p>
    {/if}
    <footer class="small muted">
      An AI forecast written by {a.model} from {sources.join(', ')}. Every number in it is checked against that data.
    </footer>
  {:else}
    <h2 class="title">No forecast written yet</h2>
    <p class="muted">It's added on the next scheduled update.</p>
  {/if}
</article>

<style>
  .post {
    display: grid;
    gap: 0;
  }
  header {
    display: flex;
    gap: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--hairline);
  }
  header div {
    display: grid;
    align-content: center;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 14px;
  }
  .title {
    font-size: 26px;
    font-weight: 800;
    margin: 16px 0 6px;
  }
  h3 {
    font-size: 19px;
    font-weight: 800;
    margin: 18px 0 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--hairline);
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  p {
    margin: 0 0 12px;
    font-size: 17px;
    line-height: 1.55;
  }
  .warn {
    color: var(--text);
  }
  footer {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
  }
</style>
