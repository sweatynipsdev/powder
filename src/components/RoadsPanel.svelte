<script lang="ts">
  import type { Cam, RoadsData, SourceStatus } from '../../shared/types';
  import { clockTime, ROAD_STATUS } from '../lib/display';
  import CamViewer from './CamViewer.svelte';
  import StaleChip from './StaleChip.svelte';

  interface Props {
    roads: RoadsData | null;
    status: SourceStatus;
    cams: Cam[];
  }

  let { roads, status, cams }: Props = $props();

  let open = $state<number | null>(null);

  // Data cached on a phone before WSDOT was added has no agencies: it was all Caltrans.
  const AGENCIES: Record<string, { caption: string; link: { label: string; url: string } }> = {
    Caltrans: { caption: 'Caltrans chain controls and highway conditions', link: { label: 'Caltrans QuickMap', url: 'https://quickmap.dot.ca.gov/' } },
    WSDOT: { caption: 'WSDOT mountain pass reports', link: { label: 'WSDOT mountain passes', url: 'https://wsdot.com/travel/real-time/mountainpasses' } },
  };
  let agencies = $derived((roads?.agencies ?? ['Caltrans']).map((a) => AGENCIES[a]).filter(Boolean));
</script>

<section class="card" aria-label="Roads">
  <div class="head">
    <StaleChip {status} hasData={!!roads} />
  </div>
  {#if roads}
    <ul>
      {#each roads.segments as s (s.label)}
        {@const st = ROAD_STATUS[s.status]}
        <li>
          <div class="row">
            <span class="secondary">{s.label}</span>
            <span class="status {st.tone}"><span aria-hidden="true">{st.icon}</span>{s.restriction ?? st.label}</span>
          </div>
          {#if s.worst}
            <p class="small secondary">{s.worst.name}: {s.worst.description}{s.worst.since ? ` (since ${s.worst.since.replace('T', ' ')})` : ''}</p>
          {/if}
          {#each s.closures as c (c.description)}
            <p class="small secondary">⛔ {c.description}{c.start ? ` · ${clockTime(c.start)}` : ''}{c.end ? `–${clockTime(c.end)}` : ''}</p>
          {/each}
          {#each s.notes as n (n)}<p class="small muted">{n}</p>{/each}
        </li>
      {/each}
    </ul>
    <p class="small muted">{agencies.map((a) => a.caption).join(' · ')}{roads.textAsOf ? `, as of ${roads.textAsOf}` : ''}.</p>
  {/if}
  {#if cams.length}
    <div class="cams">
      {#each cams as c, i (c.url)}
        <button type="button" onclick={() => (open = i)}>
          <span class="frame">
            <img src={c.url} alt={c.label} loading="lazy" />
            {#if c.video || c.player}<span class="live">LIVE</span>{/if}
          </span>
          <span class="small secondary">{c.label}</span>
        </button>
      {/each}
    </div>
    {#if open !== null}
      <CamViewer {cams} start={open} onclose={() => (open = null)} />
    {/if}
  {/if}
  {#each agencies as a (a.link.url)}
    <p class="small"><a href={a.link.url} target="_blank" rel="noopener">{a.link.label} ↗</a></p>
  {/each}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  p {
    margin: 4px 0 0;
  }
  .cams {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  .cams button {
    display: grid;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
  }
  .frame {
    position: relative;
  }
  .cams img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border-radius: 8px;
    background: var(--card-2);
  }
  .live {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--closed);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
