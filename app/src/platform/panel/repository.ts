import { BrowserRepository, isBool, isNumber, readPref, storedText, writePref } from '../../shell/prefs';
import { DEFAULT_PANELS, PANEL_LIMITS, type Panels } from './model';

const NAV_WIDTH_KEY = 'lathe:nav-width';
const NAV_COLLAPSED_KEY = 'lathe:nav-collapsed';

/** Loads and saves the panels whole: the nav's width and whether it is collapsed, as JSON in local storage under `lathe:nav-width` and `lathe:nav-collapsed`. */
export class PanelRepository extends BrowserRepository<Panels> {
  protected stored() { return `${storedText(NAV_WIDTH_KEY)}\n${storedText(NAV_COLLAPSED_KEY)}`; }
  protected read(): Panels {
    const { min, max } = PANEL_LIMITS.nav;
    const inRange = (v: unknown): v is number => isNumber(v) && v >= min && v <= max;
    return { nav: { width: readPref(NAV_WIDTH_KEY, DEFAULT_PANELS.nav.width, inRange), collapsed: readPref(NAV_COLLAPSED_KEY, DEFAULT_PANELS.nav.collapsed, isBool) } };
  }
  protected write(panels: Panels) {
    writePref(NAV_WIDTH_KEY, panels.nav.width);
    writePref(NAV_COLLAPSED_KEY, panels.nav.collapsed);
  }
}

export const panelRepository = new PanelRepository();
