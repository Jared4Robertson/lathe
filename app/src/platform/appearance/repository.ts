// Generated from data/ by `npm run generate`. Do not edit.
// AppearanceRepository (LA-PLT-REPO03): Keeps the person's themes, the chosen theme, the color mode, Scroll to zoom and
// the chosen theme's stylesheet as JSON in local storage (`lathe:themes`, `lathe:theme`, `lathe:color-mode`,
// `lathe:scroll-to-zoom`, `lathe:theme-css`); the stylesheet is written with each save for index.html's early script.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { APPEARANCE_STORAGE, appearanceFrom, appearanceStored, type Appearance } from './model';

export class AppearanceRepository extends BrowserRepository<Appearance> {
  protected stored() {
    return [storedText(APPEARANCE_STORAGE.themes), storedText(APPEARANCE_STORAGE.chosen), storedText(APPEARANCE_STORAGE.mode), storedText(APPEARANCE_STORAGE.scrollToZoom), storedText(APPEARANCE_STORAGE.css)].join('\n');
  }

  protected read(): Appearance {
    const appearance = appearanceFrom({ themes: readStored(APPEARANCE_STORAGE.themes), chosen: readStored(APPEARANCE_STORAGE.chosen), mode: readStored(APPEARANCE_STORAGE.mode), scrollToZoom: readStored(APPEARANCE_STORAGE.scrollToZoom), css: readStored(APPEARANCE_STORAGE.css) });
    this.#put(appearance, true);
    return appearance;
  }

  protected write(appearance: Appearance) {
    this.#put(appearance, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(appearance: Appearance, held: boolean) {
    const stored = appearanceStored(appearance);
    putStored(APPEARANCE_STORAGE.themes, stored.themes, held);
    putStored(APPEARANCE_STORAGE.chosen, stored.chosen, held);
    putStored(APPEARANCE_STORAGE.mode, stored.mode, held);
    putStored(APPEARANCE_STORAGE.scrollToZoom, stored.scrollToZoom, held);
    putStored(APPEARANCE_STORAGE.css, stored.css, held);
  }
}

export const appearanceRepository = new AppearanceRepository();
