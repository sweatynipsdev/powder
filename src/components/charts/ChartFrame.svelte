<script lang="ts">
  // A chart's figure: title, legend, the chart itself, and its table-view twin.
  import type { Snippet } from 'svelte';

  export interface LegendItem {
    label: string;
    color: string;
    kind: 'line' | 'rect' | 'band';
  }

  interface Props {
    title: string;
    subtitle?: string;
    legend?: LegendItem[];
    table: { columns: string[]; rows: (string | number)[][] };
    children: Snippet;
  }

  let { title, subtitle, legend = [], table, children }: Props = $props();
  let showTable = $state(false);
</script>

<figure class="card">
  <header>
    <div>
      <h2>{title}</h2>
      {#if subtitle}<p class="small muted">{subtitle}</p>{/if}
    </div>
    <button class="toggle small" aria-pressed={showTable} onclick={() => (showTable = !showTable)}>
      {showTable ? 'Chart' : 'Table'}
    </button>
  </header>

  {#if legend.length && !showTable}
    <ul class="legend small">
      {#each legend as item (item.label)}
        <li>
          <span class="key {item.kind}" style:--c={item.color}></span>{item.label}
        </li>
      {/each}
    </ul>
  {/if}

  {#if showTable}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>{#each table.columns as c (c)}<th scope="col">{c}</th>{/each}</tr>
        </thead>
        <tbody>
          {#each table.rows as row, i (i)}
            <tr>{#each row as cell, j (j)}<td>{cell}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    {@render children()}
  {/if}
</figure>

<style>
  figure {
    margin: 0;
    padding: 14px 12px 10px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 0 4px;
  }
  header p {
    margin: 2px 0 0;
  }
  .toggle {
    background: var(--surface-2);
    border: 1px solid var(--hairline);
    border-radius: 999px;
    padding: 3px 10px;
    cursor: pointer;
    color: var(--text-secondary);
    flex: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    list-style: none;
    margin: 10px 0 2px;
    padding: 0 4px;
    color: var(--text-secondary);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .key {
    display: inline-block;
    flex: none;
  }
  .key.line {
    width: 14px;
    height: 2px;
    border-radius: 1px;
    background: var(--c);
  }
  .key.rect {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--c);
  }
  .key.band {
    width: 14px;
    height: 10px;
    border-radius: 2px;
    background: var(--c);
  }
  .table-wrap {
    overflow-x: auto;
    margin-top: 10px;
  }
</style>
