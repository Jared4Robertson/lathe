import { VOICE_COMMANDS, phraseWords } from '../../chat/voice/grammar';
import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { COMMAND_LABEL, type VoiceSettings } from './model';

/** The most words a phrase may have: a wake phrase or a command is said in a breath. */
export const MOST_PHRASE_WORDS = 3;

const said = (phrase: string) => phraseWords(phrase).join(' ');

/**
 * What breaks the Voice settings' rule (voice-phrases-distinct, LA-PLT-INV44): a wake phrase or command with no words or
 * more than three, two commands with the same words, or a command that is the wake phrase.
 */
export function voiceSettingsProblems(settings: VoiceSettings): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const check = (phrase: string, name: string) => {
    const n = phraseWords(phrase).length;
    if (n === 0) problems.push({ rule: 'voice-phrases-distinct', message: `${name} needs a word.` });
    else if (n > MOST_PHRASE_WORDS) problems.push({ rule: 'voice-phrases-distinct', message: `${name} has more than ${MOST_PHRASE_WORDS} words.` });
  };
  check(settings.wake, 'The wake phrase');
  const seen = new Map<string, string>();
  for (const c of VOICE_COMMANDS) {
    const name = `The command "${COMMAND_LABEL[c]}"`;
    check(settings.commands[c], name);
    const words = said(settings.commands[c]);
    if (!words) continue;
    if (words === said(settings.wake)) problems.push({ rule: 'voice-phrases-distinct', message: `${name} is the wake phrase.` });
    const other = seen.get(words);
    if (other) problems.push({ rule: 'voice-phrases-distinct', message: `${name} has the same words as "${other}".` });
    seen.set(words, COMMAND_LABEL[c]);
  }
  return problems;
}

/** Refuses settings that break the rule, with every reason. */
export const holdToRules = (settings: VoiceSettings) => refuseBroken(voiceSettingsProblems(settings));
