<script lang="ts">
  // The hand-written local knowledge the write-ups use, shown so it can be checked.
  interface Props {
    notes: string[];
  }

  let { notes }: Props = $props();
</script>

{#if notes.length}
  <details class="card notes">
    <summary><strong>Local knowledge</strong> <span class="small muted">· what the forecast writer knows about this mountain</span></summary>
    <ul>
      {#each notes as n (n)}<li class="secondary">{n}</li>{/each}
    </ul>
    <p class="small muted">Edit in <code>resorts.json</code> → <code>local.notes</code>; sources are listed there.</p>
  </details>
{/if}

<style>
  summary {
    cursor: pointer;
  }
  ul {
    margin: 10px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }
  p {
    margin: 10px 0 0;
  }
</style>
