import { useAggregate } from '../../shell/prefs';
import { voiceSettingsRepository } from './repository';

/** The Voice settings, read again after each command changes them. */
export const useVoiceSettings = () => useAggregate(voiceSettingsRepository);
