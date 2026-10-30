import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { themeCss } from '../../theme/css';
import { appearanceFrom, chosenTheme, type Appearance } from './model';

// The early script in app/index.html reads two of these keys itself, before first paint: the chosen theme's stylesheet
// and the mode. Keep the keys and their JSON in step with it.

export const APPEARANCE_KEYS = {
  themes: 'lathe:themes',
  chosen: 'lathe:theme',
  mode: 'lathe:color-mode',
  scrollToZoom: 'lathe:scroll-to-zoom',
  /** The chosen theme written as its stylesheet, so index.html can apply it before first paint. */
  css: 'lathe:theme-css',
} as const;

const isAny = (_v: unknown): _v is unknown => true;
const read = (key: string) => readPref<unknown>(key, undefined, isAny);

/**
 * Loads and saves the Appearance whole, as JSON in local storage: the person's own themes, the chosen theme's ID, the
 * mode and Scroll to zoom, and with each save the chosen theme's stylesheet for the early script.
 */
export class AppearanceRepository extends BrowserRepository<Appearance> {
  protected stored() { return [APPEARANCE_KEYS.themes, APPEARANCE_KEYS.chosen, APPEARANCE_KEYS.mode, APPEARANCE_KEYS.scrollToZoom].map((k) => storedText(k)).join('\n'); }
  protected read() { return appearanceFrom(read(APPEARANCE_KEYS.themes), read(APPEARANCE_KEYS.chosen), read(APPEARANCE_KEYS.mode), read(APPEARANCE_KEYS.scrollToZoom)); }
  protected write(appearance: Appearance) {
    writePref(APPEARANCE_KEYS.themes, appearance.custom.map(({ builtIn: _builtIn, ...rest }) => rest));
    writePref(APPEARANCE_KEYS.chosen, appearance.chosen);
    writePref(APPEARANCE_KEYS.mode, appearance.mode);
    writePref(APPEARANCE_KEYS.scrollToZoom, appearance.scrollToZoom);
    try { window.localStorage.setItem(APPEARANCE_KEYS.css, themeCss(chosenTheme(appearance))); } catch { /* storage full or blocked: the choice lasts until reload */ }
  }
}

export const appearanceRepository = new AppearanceRepository();
