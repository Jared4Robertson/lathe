// Generated from data/ by `npm run generate`. Do not edit.
// PanelRepository (LA-PLT-REPO01): Keeps the nav's width and whether it is collapsed as JSON in local storage,
// `lathe:nav-width` and `lathe:nav-collapsed`, loaded and saved whole; the app works on without storage.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { PANEL_STORAGE, panelFrom, panelStored, type Panels } from './model';

export class PanelRepository extends BrowserRepository<Panels> {
  protected stored() {
    return [storedText(PANEL_STORAGE.navWidth), storedText(PANEL_STORAGE.navCollapsed)].join('\n');
  }

  protected read(): Panels {
    const panel = panelFrom({ navWidth: readStored(PANEL_STORAGE.navWidth), navCollapsed: readStored(PANEL_STORAGE.navCollapsed) });
    this.#put(panel, true);
    return panel;
  }

  protected write(panel: Panels) {
    this.#put(panel, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(panel: Panels, held: boolean) {
    const stored = panelStored(panel);
    putStored(PANEL_STORAGE.navWidth, stored.navWidth, held);
    putStored(PANEL_STORAGE.navCollapsed, stored.navCollapsed, held);
  }
}

export const panelRepository = new PanelRepository();
