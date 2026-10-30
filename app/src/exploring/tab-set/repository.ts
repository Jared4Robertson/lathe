import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { DEFAULT_STAGE, isFocusPath, parseStage } from '../../views/address';
import { readView } from '../../views/place';
import { parseTabSet, type KeptCamera, type TabSet, type TabSets } from './model';

// Keeps the Tab set aggregate, each part where it lasts as long as it should: every space's tab set under `lathe:tabs`
// and the view last set under `lathe:place`, both in session storage (the window's session); the stage last chosen
// under `lathe:stage` in local storage (from one launch to the next); and the places' cameras in memory, kept while the
// window is open and not through a reload. Only this module reads or writes those keys; anything malformed is dropped.

const SETS_KEY = 'lathe:tabs';
const VIEW_KEY = 'lathe:place';
const STAGE_KEY = 'lathe:stage';
const isAny = (_v: unknown): _v is unknown => true;
const isAddress = (address: string) => isFocusPath(address.split(/[?#]/)[0]);

function readSets(raw: unknown): Record<string, TabSet> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, TabSet> = {};
  for (const [space, value] of Object.entries(raw as Record<string, unknown>)) {
    const set = parseTabSet(value, isAddress);
    if (set) out[space] = set;
  }
  return out;
}

export class TabSetRepository extends BrowserRepository<TabSets> {
  #cameras: ReadonlyMap<string, KeptCamera<unknown>> = new Map();

  protected stored() {
    return [storedText(SETS_KEY, 'session'), storedText(VIEW_KEY, 'session'), storedText(STAGE_KEY)].join('\n');
  }

  protected read(): TabSets {
    return {
      sets: readSets(readPref<unknown>(SETS_KEY, null, isAny, 'session')),
      view: readView(readPref<unknown>(VIEW_KEY, null, isAny, 'session')),
      stage: parseStage(readPref<unknown>(STAGE_KEY, null, isAny) as string | null) ?? DEFAULT_STAGE,
      cameras: this.#cameras,
    };
  }

  protected write(tabs: TabSets) {
    const was = this.load();
    if (tabs.sets !== was.sets) writePref(SETS_KEY, tabs.sets, 'session');
    if (tabs.view !== was.view) writePref(VIEW_KEY, tabs.view, 'session');
    if (tabs.stage !== was.stage) writePref(STAGE_KEY, tabs.stage);
    this.#cameras = tabs.cameras;
  }
}

export const tabSetRepository = new TabSetRepository();
