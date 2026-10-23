// Per-viewer conveniences, remembered in localStorage when it's available.

import type { Elev } from '../../shared/types';

const KEY = 'powder.elevation';

function read(): Elev {
  try {
    return localStorage.getItem(KEY) === 'base' ? 'base' : 'summit';
  } catch {
    return 'summit';
  }
}

export const prefs = $state({ elevation: read() });

export function setElevation(e: Elev): void {
  prefs.elevation = e;
  try {
    localStorage.setItem(KEY, e);
  } catch {
    // Private mode or storage blocked: the choice just won't persist.
  }
}
