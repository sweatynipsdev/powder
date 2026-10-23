<script lang="ts">
  // Shown next to a panel whose source failed this run: its age, or that it's missing.
  import type { SourceStatus } from '../../shared/types';
  import { timeAgo } from '../lib/display';

  interface Props {
    status: SourceStatus | null | undefined;
    hasData: boolean;
  }

  let { status, hasData }: Props = $props();
</script>

{#if status && !status.ok}
  <span class="status warning" title={status.error ?? ''}>
    <span class="dot"></span>{hasData ? `stale · ${timeAgo(status.fetchedAt)}` : 'unavailable'}
  </span>
{/if}
