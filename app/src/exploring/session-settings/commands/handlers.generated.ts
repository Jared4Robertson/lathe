// Generated from data/ by `npm run generate`. Do not edit.
// The session settings commands that set one setting, each named in the model's SESSION_SETTINGS_SETS: load the session
// settings, keep the input's value in its place, hold them to their rules and save; the same value again saves nothing.
import type { SessionSettings } from '../model';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseChangesBaseline { since: SessionSettings['changes']['since'] }

/** Sets what Highlight changes compares with: the last commit, the branch, or when the Reader last looked; another baseline is refused. */
export function chooseChangesBaseline({ since }: ChooseChangesBaseline): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.since === since) return;
  const next = { ...was, changes: { ...was.changes, since } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface ChooseGraphLayout { layout: SessionSettings['graph']['layout'] }

/** Sets the graph's layout, Tree or Nested, for the browser session; a layout the graph does not have is refused. */
export function chooseGraphLayout({ layout }: ChooseGraphLayout): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.layout === layout) return;
  const next = { ...was, graph: { ...was.graph, layout } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface ShowOrHideAllLinks { shown: SessionSettings['graph']['allLinks'] }

/** Has the graph's Map draw every link between the records drawn, or only the focus's, for the browser session. */
export function showOrHideAllLinks({ shown }: ShowOrHideAllLinks): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.allLinks === shown) return;
  const next = { ...was, graph: { ...was.graph, allLinks: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface ShowOrHideChat { shown: SessionSettings['chat']['open'] }

/** Opens or closes the chat panel for the browser session. */
export function showOrHideChat({ shown }: ShowOrHideChat): void {
  const was = sessionSettingsRepository.load();
  if (was.chat.open === shown) return;
  const next = { ...was, chat: { ...was.chat, open: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface ShowOrHideMinimap { shown: SessionSettings['graph']['minimap'] }

/** Shows or hides the graph's minimap for the browser session. */
export function showOrHideMinimap({ shown }: ShowOrHideMinimap): void {
  const was = sessionSettingsRepository.load();
  if (was.graph.minimap === shown) return;
  const next = { ...was, graph: { ...was.graph, minimap: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface TurnFollowOnOrOff { on: SessionSettings['changes']['follow'] }

/** Turns Follow on or off, which opens each changed record as it changes. */
export function turnFollowOnOrOff({ on }: TurnFollowOnOrOff): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.follow === on) return;
  const next = { ...was, changes: { ...was.changes, follow: on } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}

export interface TurnHighlightChangesOnOrOff { on: SessionSettings['changes']['highlight'] }

/** Turns Highlight changes on or off for the browser session. */
export function turnHighlightChangesOnOrOff({ on }: TurnHighlightChangesOnOrOff): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.highlight === on) return;
  const next = { ...was, changes: { ...was.changes, highlight: on } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
