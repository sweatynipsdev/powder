<script lang="ts">
  // Follow or unfollow a resort. A filled orange star means it's on this phone's Favorites.
  import { favorites, isFavorite, toggle } from '../lib/favorites.svelte';

  interface Props {
    id: string;
    name: string;
  }

  let { id, name }: Props = $props();
  let on = $derived(isFavorite(id));
</script>

<!-- Hidden until favorites load: a tap before then can't know what's already starred. -->
{#if favorites.ready}
<button
  class="star"
  class:on
  type="button"
  aria-pressed={on}
  aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
  onclick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(id);
  }}
>
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linejoin="round"
    />
  </svg>
</button>
{/if}

<style>
  .star {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .star.on {
    color: var(--snow-big);
  }
  .star:focus-visible {
    outline: 2px solid var(--accent);
  }
</style>
