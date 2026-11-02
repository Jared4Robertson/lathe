// Generated from data/ by `npm run generate`. Do not edit.
// TabSetRepository (LA-EXP-REPO04): Keeps the window's tabs whole: every space's tab set under `lathe:tabs` and the
// view last set under `lathe:place` in session storage, the stage last chosen under `lathe:stage` in local storage, and
// each place's cameras in memory while the window is open.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { TAB_SET_STORAGE, tabSetFrom, type TabSets } from './model';

export class TabSetRepository extends BrowserRepository<TabSets> {
  #cameras: unknown;

  protected stored() {
    return [storedText(TAB_SET_STORAGE.sets), storedText(TAB_SET_STORAGE.view), storedText(TAB_SET_STORAGE.stage)].join('\n');
  }

  protected read(): TabSets {
    const tabSet = tabSetFrom({ sets: readStored(TAB_SET_STORAGE.sets), view: readStored(TAB_SET_STORAGE.view), stage: readStored(TAB_SET_STORAGE.stage), cameras: this.#cameras });
    this.#put(tabSet, true);
    return tabSet;
  }

  protected write(tabSet: TabSets) {
    this.#put(tabSet, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(tabSet: TabSets, held: boolean) {
    putStored(TAB_SET_STORAGE.sets, tabSet.sets, held);
    putStored(TAB_SET_STORAGE.view, tabSet.view, held);
    putStored(TAB_SET_STORAGE.stage, tabSet.stage, held);
    this.#cameras = tabSet.cameras;
  }
}

export const tabSetRepository = new TabSetRepository();
