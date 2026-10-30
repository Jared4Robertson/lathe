// Turn voice activation on or off (LA-PLT-CMD61): the chat listens for the wake phrase while the window is in front,
// or does not listen until the Owner dictates; kept from one launch to the next.
import { voiceSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnVoiceActivationOnOrOff { on: boolean }

/** Keeps whether voice activation is on; no change saves nothing. */
export function turnVoiceActivationOnOrOff({ on }: TurnVoiceActivationOnOrOff): void {
  const was = voiceSettingsRepository.load();
  if (was.activation === on) return;
  const next = { ...was, activation: on };
  holdToRules(next);
  voiceSettingsRepository.save(next);
}
