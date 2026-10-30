import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { sessionSettingsFrom, storedSettings, type SessionSettings } from './model';

/** The key the session's settings are kept under, in session storage. */
export const SETTINGS_KEY = 'lathe:session-settings';
const isAny = (_v: unknown): _v is unknown => true;

/** Loads and saves the Session settings whole, as JSON under `lathe:session-settings` in session storage. */
export class SessionSettingsRepository extends BrowserRepository<SessionSettings> {
  protected stored() { return storedText(SETTINGS_KEY, 'session') ?? ''; }
  protected read() { return sessionSettingsFrom(readPref<unknown>(SETTINGS_KEY, null, isAny, 'session')); }
  protected write(settings: SessionSettings) { writePref(SETTINGS_KEY, storedSettings(settings), 'session'); }
}

export const sessionSettingsRepository = new SessionSettingsRepository();
