import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { voiceSettingsFrom, type VoiceSettings } from './model';

/** The key the Voice settings are kept under, in local storage. */
const VOICE_KEY = 'lathe:voice';
const isAny = (_v: unknown): _v is unknown => true;

/** Loads and saves the Voice settings whole, as JSON under `lathe:voice` in local storage, from one launch to the next. */
class VoiceSettingsRepository extends BrowserRepository<VoiceSettings> {
  protected stored() { return storedText(VOICE_KEY) ?? ''; }
  protected read() { return voiceSettingsFrom(readPref<unknown>(VOICE_KEY, null, isAny)); }
  protected write(settings: VoiceSettings) { writePref(VOICE_KEY, settings); }
}

export const voiceSettingsRepository = new VoiceSettingsRepository();
