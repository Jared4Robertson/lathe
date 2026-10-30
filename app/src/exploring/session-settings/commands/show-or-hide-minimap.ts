// Show or hide the minimap (LA-EXP-CMD40): the Reader turns the graph's minimap on or off, for every tab of the session.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ShowOrHideMinimap { shown: boolean }

/** Keeps whether the minimap shows; no change saves nothing. */
export function showOrHideMinimap({ shown }: ShowOrHideMinimap): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.minimap === shown) return;
  const next = { ...was, graph: { ...was.graph, minimap: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
