// Generated from data/ by `npm run generate`. Do not edit.
// NavRowRepository (LA-EXP-REPO03): Keeps which nav rows are open as JSON in session storage under `lathe:nav-folders`
// (the domain, stage and folder rows), loaded and saved whole.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { NAV_ROW_STORAGE, navRowFrom, type NavRows } from './model';

export class NavRowRepository extends BrowserRepository<NavRows> {
  protected stored() {
    return [storedText(NAV_ROW_STORAGE.folders)].join('\n');
  }

  protected read(): NavRows {
    const navRow = navRowFrom({ folders: readStored(NAV_ROW_STORAGE.folders) });
    this.#put(navRow, true);
    return navRow;
  }

  protected write(navRow: NavRows) {
    this.#put(navRow, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(navRow: NavRows, held: boolean) {
    putStored(NAV_ROW_STORAGE.folders, navRow.folders, held);
  }
}

export const navRowRepository = new NavRowRepository();
