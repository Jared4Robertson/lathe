// Choose the voice phrases (LA-PLT-CMD63): the wake phrase and each voice command's words, refused with every reason
// when one has no words or too many, two commands share their words, or a command is the wake phrase.
import type { VoiceCommand } from '../../../chat/voice/grammar';
import { voiceSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseVoicePhrases { wake: string; commands: Record<VoiceCommand, string> }

const tidy = (phrase: string) => phrase.trim().replace(/\s+/g, ' ');

/** Keeps the phrases, tidied of extra spaces; throws RuleBroken with every reason when they break the rule. */
export function chooseVoicePhrases({ wake, commands }: ChooseVoicePhrases): void {
  const was = voiceSettingsRepository.load();
  const next = { ...was, wake: tidy(wake), commands: Object.fromEntries(Object.entries(commands).map(([c, p]) => [c, tidy(p)])) as Record<VoiceCommand, string> };
  holdToRules(next);
  voiceSettingsRepository.save(next);
}
