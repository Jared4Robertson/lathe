import { holdToRules } from './rules';
import { tabSetRepository } from './repository';
import type { TabSets } from './model';

// How a Tab set command is carried out. Its handler is a pure function from the tab sets and its input to the tab sets
// it leaves, so the page can show a move's result while it renders (usePageTabs arrives at an address during render,
// which React may run twice) and save it only once, after the render, here: the tab sets are loaded, changed by the
// handler, held to their rules and saved whole through TabSetRepository. Nothing is saved when nothing changed.

export type TabSetCommand<I> = (tabs: TabSets, input: I) => TabSets;

/** Runs a Tab set command: load, change, hold to the rules, save. */
export function runTabSetCommand<I>(command: TabSetCommand<I>, input: I): void {
  const was = tabSetRepository.load();
  const next = command(was, input);
  if (next === was) return;
  holdToRules(next);
  tabSetRepository.save(next);
}
