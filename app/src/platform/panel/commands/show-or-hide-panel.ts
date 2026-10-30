// Show or hide a panel (LA-PLT-CMD02): the person opens a panel or collapses it to give its room to the stage.
import type { PanelName } from '../model';
import { panelRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ShowOrHidePanel { panel: PanelName; shown: boolean }

/** Keeps whether a panel shows; no change saves nothing. */
export function showOrHidePanel({ panel, shown }: ShowOrHidePanel): void {
  const was = panelRepository.load();
  if (was[panel].collapsed === !shown) return;
  const panels = { ...was, [panel]: { ...was[panel], collapsed: !shown } };
  holdToRules(panels);
  panelRepository.save(panels);
}
