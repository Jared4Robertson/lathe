import { VOICE_COMMANDS, type Phrases, type VoiceCommand } from '../../chat/voice/grammar.ts';

// Voice settings (LA-PLT-A15): how the Owner talks to the desktop chat, kept from one launch to the next: voice
// activation (listen for the wake phrase while the window is in front), Quick mode (send a dictated message by itself
// when they have finished), the wake phrase, and each voice command's words (chat/voice/grammar.ts). Both are off
// until the Owner turns them on.
// With its imports' extensions: the desktop app's tests compile this file too, under Node's resolution.

export interface VoiceSettings {
  activation: boolean;
  quick: boolean;
  /** The words that wake the chat, and come before each command: "Lathe" by default, "Hey Lathe" the stricter one offered. */
  wake: string;
  commands: Record<VoiceCommand, string>;
}

export const DEFAULT_WAKE = 'Lathe';
/** The stricter wake phrase offered, for when "Lathe" alone wakes the chat too often. */
export const STRICT_WAKE = 'Hey Lathe';
export const DEFAULT_COMMANDS: Record<VoiceCommand, string> = { send: 'send', cancel: 'cancel', scratch: 'scratch that', newLine: 'new line' };
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { activation: false, quick: false, wake: DEFAULT_WAKE, commands: DEFAULT_COMMANDS };

/** What each command does, as the settings name it. */
export const COMMAND_LABEL: Record<VoiceCommand, string> = { send: 'Send', cancel: 'Clear the message', scratch: 'Remove the last sentence', newLine: 'New paragraph' };

/** The phrases the grammar reads. */
export const phrasesOf = (settings: VoiceSettings): Phrases => ({ wake: settings.wake, commands: settings.commands });

/** The settings as stored; anything malformed (an older form included) is dropped for the defaults. */
export function voiceSettingsFrom(stored: unknown): VoiceSettings {
  if (!stored || typeof stored !== 'object') return DEFAULT_VOICE_SETTINGS;
  const s = stored as Partial<VoiceSettings>;
  const commands = s.commands && typeof s.commands === 'object' ? s.commands : null;
  if (typeof s.activation !== 'boolean' || typeof s.quick !== 'boolean' || typeof s.wake !== 'string' || !commands || !VOICE_COMMANDS.every((c) => typeof commands[c] === 'string')) return DEFAULT_VOICE_SETTINGS;
  return { activation: s.activation, quick: s.quick, wake: s.wake, commands: Object.fromEntries(VOICE_COMMANDS.map((c) => [c, commands[c]])) as Record<VoiceCommand, string> };
}
