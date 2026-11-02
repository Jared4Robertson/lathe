// Generated from data/ by `npm run generate`. Do not edit.
// The voice settings commands that set one setting, each named in the model's VOICE_SETTINGS_SETS: load the voice
// settings, keep the input's value in its place, hold them to their rules and save; the same value again saves nothing.
import type { VoiceSettings } from '../model';
import { voiceSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnQuickModeOnOrOff { on: VoiceSettings['quick'] }

/** Sets whether a dictated message is sent by itself once the Owner has finished; kept from one launch to the next. */
export function turnQuickModeOnOrOff({ on }: TurnQuickModeOnOrOff): void {
  const was = voiceSettingsRepository.load();
  if (was.quick === on) return;
  const next = { ...was, quick: on };
  holdToRules(next);
  voiceSettingsRepository.save(next);
}

export interface TurnVoiceActivationOnOrOff { on: VoiceSettings['activation'] }

/** Sets whether the chat listens for the wake phrase while the window is in front; kept from one launch to the next. */
export function turnVoiceActivationOnOrOff({ on }: TurnVoiceActivationOnOrOff): void {
  const was = voiceSettingsRepository.load();
  if (was.activation === on) return;
  const next = { ...was, activation: on };
  holdToRules(next);
  voiceSettingsRepository.save(next);
}
