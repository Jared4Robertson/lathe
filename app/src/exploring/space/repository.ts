import { BrowserRepository, isBool, readPref, storedText, writePref } from '../../shell/prefs';
import { NO_SPACE_MEMORY, readPages, type SpaceMemory } from './model';

// Keeps the Space aggregate: the space chosen last under `lathe:space` in local storage (kept from one launch to the
// next), each space's last page under `lathe:space-pages` in session storage, and whether two or more spaces were
// listed last time under `lathe:space-rail` in local storage. Only this module reads or writes those keys.

const CHOSEN_KEY = 'lathe:space';
const PAGES_KEY = 'lathe:space-pages';
const RAIL_KEY = 'lathe:space-rail';
const isString = (v: unknown): v is string => typeof v === 'string';
const isAny = (_v: unknown): _v is unknown => true;

export class SpaceRepository extends BrowserRepository<SpaceMemory> {
  protected stored() {
    return [storedText(CHOSEN_KEY), storedText(PAGES_KEY, 'session'), storedText(RAIL_KEY)].join('\n');
  }

  protected read(): SpaceMemory {
    return {
      chosen: readPref(CHOSEN_KEY, NO_SPACE_MEMORY.chosen, isString),
      pages: readPages(readPref<unknown>(PAGES_KEY, null, isAny, 'session')),
      several: readPref(RAIL_KEY, NO_SPACE_MEMORY.several, isBool),
    };
  }

  protected write(memory: SpaceMemory) {
    const was = this.load();
    if (memory.chosen !== was.chosen) writePref(CHOSEN_KEY, memory.chosen);
    if (memory.pages !== was.pages) writePref(PAGES_KEY, memory.pages, 'session');
    if (memory.several !== was.several) writePref(RAIL_KEY, memory.several);
  }
}

export const spaceRepository = new SpaceRepository();
