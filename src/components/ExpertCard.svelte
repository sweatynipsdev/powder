<script lang="ts">
  // The "Local Expert" card: who wrote it, when, the headline and a short summary.
  import { timeAgo } from '../lib/display';

  interface Props {
    author: string;
    role: string;
    /** Avatar image URL, or initials when there's no photo. */
    avatar: { src?: string; initials?: string };
    at: string | null;
    title: string;
    text: string;
    href: string;
    external?: boolean;
  }

  let { author, role, avatar, at, title, text, href, external = false }: Props = $props();
</script>

<article class="card expert">
  <header>
    {#if avatar.src}
      <img class="avatar" src={avatar.src} alt="" />
    {:else}
      <span class="avatar initials">{avatar.initials}</span>
    {/if}
    <div>
      <strong>{author}</strong>
      <span class="small muted">{role}{at ? ` · ${timeAgo(at)}` : ''}</span>
    </div>
  </header>
  <h3>{title}</h3>
  <p class="secondary">{text}</p>
  <a {href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}>Read More{external ? ' ↗' : ''}</a>
</article>

<style>
  .expert {
    display: grid;
    gap: 10px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  header div {
    display: grid;
  }
  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    flex: none;
    object-fit: cover;
    background: var(--card-2);
  }
  .initials {
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;
    color: #fff;
    background: linear-gradient(135deg, #2b6cb0, #1b3a5c);
  }
  h3 {
    font-size: 19px;
    font-weight: 800;
  }
  p {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  a {
    font-weight: 700;
    font-size: 17px;
  }
</style>
