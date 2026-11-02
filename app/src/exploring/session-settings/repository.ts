// Generated from data/ by `npm run generate`. Do not edit.
// SessionSettingsRepository (LA-EXP-REPO05): Keeps the Session settings as JSON under `lathe:session-settings` in
// session storage, loaded and saved whole; a stored value of another form reads as the defaults.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { SESSION_SETTINGS_STORAGE, sessionSettingsFrom, sessionSettingsStored, type SessionSettings } from './model';

export class SessionSettingsRepository extends BrowserRepository<SessionSettings> {
  protected stored() {
    return storedText(SESSION_SETTINGS_STORAGE) ?? '';
  }

  protected read(): SessionSettings {
    const sessionSettings = sessionSettingsFrom(readStored(SESSION_SETTINGS_STORAGE));
    this.#put(sessionSettings, true);
    return sessionSettings;
  }

  protected write(sessionSettings: SessionSettings) {
    this.#put(sessionSettings, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(sessionSettings: SessionSettings, held: boolean) {
    putStored(SESSION_SETTINGS_STORAGE, sessionSettingsStored(sessionSettings), held);
  }
}

export const sessionSettingsRepository = new SessionSettingsRepository();
