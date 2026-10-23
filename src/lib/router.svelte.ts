// Hash routing. Hash routes need no server rewrites, so GitHub Pages and the service
// worker's offline fallback just work.
//   #/            favorites        #/forecasts   all write-ups      #/roads   the drive
//   #/r/<id>      snow summary     #/r/<id>/weather                 #/r/<id>/report
//   #/r/<id>/forecast             the full written forecast

export type ResortTab = 'summary' | 'weather' | 'report' | 'forecast';

export type Route =
  | { name: 'favorites' }
  | { name: 'forecasts' }
  | { name: 'roads' }
  | { name: 'resort'; id: string; tab: ResortTab };

const TABS: ResortTab[] = ['summary', 'weather', 'report', 'forecast'];

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/r\/([a-z0-9-]+)(?:\/([a-z]+))?/);
  if (m) {
    const tab = (TABS as string[]).includes(m[2] ?? '') ? (m[2] as ResortTab) : 'summary';
    return { name: 'resort', id: m[1], tab };
  }
  if (hash.startsWith('#/forecasts')) return { name: 'forecasts' };
  if (hash.startsWith('#/roads')) return { name: 'roads' };
  return { name: 'favorites' };
}

export const router = $state({ route: parseRoute(location.hash) });

window.addEventListener('hashchange', () => {
  const next = parseRoute(location.hash);
  const sameResort = router.route.name === 'resort' && next.name === 'resort' && router.route.id === next.id;
  router.route = next;
  // Switching tabs within a resort keeps your place; anything else starts at the top.
  if (!sameResort) window.scrollTo(0, 0);
});

export const resortHref = (id: string, tab: ResortTab = 'summary') => (tab === 'summary' ? `#/r/${id}` : `#/r/${id}/${tab}`);
