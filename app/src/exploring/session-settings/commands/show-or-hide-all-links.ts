// Show or hide all links (LA-EXP-CMD48): the Reader has the graph's Map draw every link between the records drawn, or
// only the focus's and the selection's, for every tab of the session.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ShowOrHideAllLinks { shown: boolean }

/** Keeps whether the Map draws all its links; no change saves nothing. */
export function showOrHideAllLinks({ shown }: ShowOrHideAllLinks): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.allLinks === shown) return;
  const next = { ...was, graph: { ...was.graph, allLinks: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
