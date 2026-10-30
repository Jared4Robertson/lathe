// Listen for the voice, or stop (LA-PLT-CMD64, LA-PLT-UC20): the window's chat starts or stops listening; it listens
// only while its window is in front. Refused where the Mac cannot recognize on-device, or the microphone is denied.
import type { VoiceListener } from '../../voice.ts';
import { chatOf } from '../model.ts';
import type { WindowChatRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type Listening = 'listening' | 'background' | 'denied' | 'unavailable' | 'stopped';

export interface ListenForVoice {
  folder: string;
  /** What the page sent: true to listen, anything else to stop. */
  on: unknown;
  /** Whether the window may listen (main.ts: the voice support, and macOS's microphone permission, asked the first time). */
  allowed: () => Promise<'allowed' | 'denied' | 'unavailable'>;
  /** Makes the window's listener (main.ts runs the speech helper); null when the window has gone. */
  listener: () => VoiceListener | null;
}

export async function listenForVoice(chats: WindowChatRepository, input: ListenForVoice): Promise<Listening> {
  if (input.on !== true) return chats.load().open.get(input.folder)?.voice?.want(false) ?? 'stopped';
  const allowed = await input.allowed();
  if (allowed !== 'allowed') return allowed;
  const now = chats.load();
  const chat = chatOf(now, input.folder);
  if (chat.voice) return chat.voice.want(true);
  const voice = input.listener();
  if (!voice) return 'stopped';
  const next = { ...now, open: new Map(now.open).set(input.folder, { ...chat, voice }) };
  holdToRules(next);
  chats.save(next);
  return voice.want(true);
}
