// Remember the stage (LA-EXP-CMD27): the stage the Reader chose becomes the one a place starts on when its address names none, kept from one launch to the next.
import type { StageName } from '../../../views/address';
import type { TabSets } from '../model';

export interface RememberStage {
  stage: StageName;
}

/** Keeps the stage last chosen. */
export function rememberStage(tabs: TabSets, input: RememberStage): TabSets {
  return tabs.stage === input.stage ? tabs : { ...tabs, stage: input.stage };
}
