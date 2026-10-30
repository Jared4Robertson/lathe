import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { readOpenMap, type NavRows } from './model';

// Keeps the Nav row aggregate: the folder rows under `lathe:nav-folders` in session storage, the nav's own sections
// under `lathe:nav-sections` in local storage. Only this module reads or writes those keys; a stored value of any
// other form is dropped for none.

const FOLDERS_KEY = 'lathe:nav-folders';
const SECTIONS_KEY = 'lathe:nav-sections';
const isAny = (_v: unknown): _v is unknown => true;

export class NavRowRepository extends BrowserRepository<NavRows> {
  protected stored() {
    return [storedText(FOLDERS_KEY, 'session'), storedText(SECTIONS_KEY)].join('\n');
  }

  protected read(): NavRows {
    return {
      folders: readOpenMap(readPref<unknown>(FOLDERS_KEY, null, isAny, 'session')),
      sections: readOpenMap(readPref<unknown>(SECTIONS_KEY, null, isAny)),
    };
  }

  protected write(rows: NavRows) {
    const was = this.load();
    if (rows.folders !== was.folders) writePref(FOLDERS_KEY, rows.folders, 'session');
    if (rows.sections !== was.sections) writePref(SECTIONS_KEY, rows.sections);
  }
}

export const navRowRepository = new NavRowRepository();
