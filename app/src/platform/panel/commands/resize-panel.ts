// Resize a panel (LA-PLT-CMD01): the person drags a panel's edge or steps it from the keyboard, or resets it to its default width (null).
import { PANEL_LIMITS, widthWithin, type PanelName } from '../model';
import { panelRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResizePanel { panel: PanelName; width: number | null }

/** Keeps a panel's width, brought within its limits; the same width changes nothing. */
export function resizePanel({ panel, width }: ResizePanel): void {
  const was = panelRepository.load();
  const next = widthWithin(panel, width ?? PANEL_LIMITS[panel].fallback);
  if (was[panel].width === next) return;
  const panels = { ...was, [panel]: { ...was[panel], width: next } };
  holdToRules(panels);
  panelRepository.save(panels);
}
