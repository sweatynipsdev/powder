// Hash routing: "#/" is home, "#/r/<id>" is a resort. Hash routes need no server rewrites,
// so GitHub Pages and the service worker's offline fallback just work.

export type Route = { name: 'home' } | { name: 'resort'; id: string };

function parse(hash: string): Route {
  const m = hash.match(/^#\/r\/([a-z0-9-]+)/);
  return m ? { name: 'resort', id: m[1] } : { name: 'home' };
}

export const router = $state({ route: parse(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = parse(location.hash);
  window.scrollTo(0, 0);
});

export const resortHref = (id: string) => `#/r/${id}`;
