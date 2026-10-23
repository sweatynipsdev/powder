<script lang="ts">
  import type { ResortData } from '../../shared/types';

  interface Props {
    links: ResortData['links'];
  }

  let { links }: Props = $props();
</script>

{#if links.cams.length || links.webcams || links.radar}
  <section class="card" aria-labelledby="cams">
    <h2 id="cams">Cams & radar</h2>
    {#if links.cams.length}
      <div class="cams">
        {#each links.cams as c (c.url)}
          <a href={c.url} target="_blank" rel="noopener">
            <img src={c.url} alt={c.label} loading="lazy" />
            <span class="small secondary">{c.label}</span>
          </a>
        {/each}
      </div>
    {/if}
    <p class="small links">
      {#if links.webcams}<a href={links.webcams} target="_blank" rel="noopener">All webcams ↗</a>{/if}
      {#if links.radar}<a href={links.radar} target="_blank" rel="noopener">Radar ↗</a>{/if}
    </p>
  </section>
{/if}

<style>
  .cams {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }
  .cams a {
    display: grid;
    gap: 4px;
    text-decoration: none;
  }
  img {
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border-radius: 8px;
    background: var(--surface-2);
  }
  .links {
    display: flex;
    gap: 16px;
    margin: 10px 0 0;
  }
</style>
