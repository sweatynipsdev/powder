<script lang="ts">
  import type { Link } from '../../shared/types';

  interface Props {
    cams: Link[];
    more: string | null;
  }

  let { cams, more }: Props = $props();
</script>

{#if cams.length || more}
  <div class="head">
    <h2 class="section-title">Cams</h2>
    {#if more}<a href={more} target="_blank" rel="noopener">All cams ↗</a>{/if}
  </div>
  {#if cams.length}
    <div class="carousel hscroll">
      {#each cams as c (c.url)}
        <a href={c.url} target="_blank" rel="noopener" class="cam">
          <img src={c.url} alt={c.label} loading="lazy" />
          <span class="small">{c.label}</span>
        </a>
      {/each}
    </div>
  {/if}
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
    color: var(--text-2);
  }
  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 14px;
    background: var(--card-2);
  }
</style>
