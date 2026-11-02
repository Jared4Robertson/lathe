// Generated from data/ by `npm run generate`. Do not edit.
// VoiceSettingsRepository (LA-PLT-REPO25): Keeps the Voice settings as JSON in local storage under `lathe:voice`,
// loaded and saved whole; a malformed value is dropped for the defaults (both modes off, "Lathe").
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { VOICE_SETTINGS_STORAGE, voiceSettingsFrom, type VoiceSettings } from './model';

export class VoiceSettingsRepository extends BrowserRepository<VoiceSettings> {
  protected stored() {
    return storedText(VOICE_SETTINGS_STORAGE) ?? '';
  }

  protected read(): VoiceSettings {
    const voiceSettings = voiceSettingsFrom(readStored(VOICE_SETTINGS_STORAGE));
    this.#put(voiceSettings, true);
    return voiceSettings;
  }

  protected write(voiceSettings: VoiceSettings) {
    this.#put(voiceSettings, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(voiceSettings: VoiceSettings, held: boolean) {
    putStored(VOICE_SETTINGS_STORAGE, voiceSettings, held);
  }
}

export const voiceSettingsRepository = new VoiceSettingsRepository();
