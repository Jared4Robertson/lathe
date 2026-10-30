// Choose the graph's layout (LA-EXP-CMD09): the Reader draws the graph as a Tree or Nested, for every tab of the session.
import type { GraphLayout } from '../../../graph/GraphPage';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseGraphLayout { layout: GraphLayout }

/** Keeps the layout the Reader chose; the same layout again changes nothing. */
export function chooseGraphLayout({ layout }: ChooseGraphLayout): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.layout === layout) return;
  const next = { ...was, graph: { ...was.graph, layout } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
