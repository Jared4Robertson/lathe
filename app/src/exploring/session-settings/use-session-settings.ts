import { useAggregate } from '../../shell/prefs';
import { sessionSettingsRepository } from './repository';

/** The session's settings, read again after each command changes them. */
export const useSessionSettings = () => useAggregate(sessionSettingsRepository);
