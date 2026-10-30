<script lang="ts">
  import type { Cam } from '../../shared/types';
  import CamViewer from './CamViewer.svelte';

  interface Props {
    cams: Cam[];
    more: string | null;
  }

  let { cams, more }: Props = $props();

  let open = $state<number | null>(null);
</script>

{#if cams.length || more}
  <div class="head">
    <h2 class="section-title">Cams</h2>
    {#if more}<a href={more} target="_blank" rel="noopener">All cams ↗</a>{/if}
  </div>
  {#if cams.length}
    <div class="carousel hscroll">
      {#each cams as c, i (c.url)}
        <button type="button" class="cam" onclick={() => (open = i)}>
          <span class="frame">
            <img src={c.url} alt={c.label} loading="lazy" />
            {#if c.video || c.player}<span class="live">LIVE</span>{/if}
          </span>
          <span class="small">{c.label}</span>
        </button>
      {/each}
    </div>
  {/if}
{/if}

{#if open !== null}
  <CamViewer {cams} start={open} onclose={() => (open = null)} />
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .carousel {
    display: flex;
    gap: 10px;
    margin: 0 -16px;
    padding: 0 16px;
    scroll-snap-type: x mandatory;
  }
  .cam {
    flex: 0 0 78%;
    max-width: 320px;
    scroll-snap-align: start;
    display: grid;
    gap: 5px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    color: var(--text-2);
  }
  .frame {
    position: relative;
  }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 14px;
    background: var(--card-2);
  }
  .live {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--closed);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
