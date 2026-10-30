// Turn scroll to zoom on or off (LA-PLT-CMD47): the person has scroll zoom the stages' cameras and Cmd or Ctrl with scroll
// pan them, or scroll pan as it does by default, on every stage and in every tab, from one launch to the next.
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnScrollToZoomOnOrOff { on: boolean }

/** Keeps whether scroll zooms; no change saves nothing. */
export function turnScrollToZoomOnOrOff({ on }: TurnScrollToZoomOnOrOff): void {
  const was = appearanceRepository.load();
  if (was.scrollToZoom === on) return;
  const next = { ...was, scrollToZoom: on };
  holdToRules(next);
  appearanceRepository.save(next);
}
