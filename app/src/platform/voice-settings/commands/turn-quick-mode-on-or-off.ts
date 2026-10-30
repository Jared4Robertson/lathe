// Turn Quick mode on or off (LA-PLT-CMD62): a dictated message sends by itself once the Owner has finished, or waits
// for them to send it; kept from one launch to the next.
import { voiceSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnQuickModeOnOrOff { on: boolean }

/** Keeps whether Quick mode is on; no change saves nothing. */
export function turnQuickModeOnOrOff({ on }: TurnQuickModeOnOrOff): void {
  const was = voiceSettingsRepository.load();
  if (was.quick === on) return;
  const next = { ...was, quick: on };
  holdToRules(next);
  voiceSettingsRepository.save(next);
}
