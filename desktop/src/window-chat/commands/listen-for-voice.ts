// Listen for the voice, or stop (LA-PLT-CMD64, LA-PLT-UC20): the window's chat starts or stops listening; it listens
// only while its window is in front. Refused, saying why, where the Mac cannot recognize on-device; refused where the
// microphone is denied; and answered unasked, asking nothing, while macOS has not asked for the microphone and the page
// has not said the Owner read what listening means.
import type { VoiceListener } from '../../voice.ts';
import type { WindowChatRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type Listening = 'listening' | 'background' | 'denied' | 'unavailable' | 'unasked' | 'stopped';

/** What listening came to, and why not when the Mac cannot dictate. */
export interface ListenAnswer { listening: Listening; reason: string | null }

/** Whether the window may listen: allowed, denied, unavailable with why, or unasked (macOS has not asked yet, and asking was not wanted). */
export type MayListen = { may: 'allowed' | 'denied' | 'unasked'; reason: null } | { may: 'unavailable'; reason: string };

export interface ListenForVoice {
  folder: string;
  /** What the page sent: true to listen, anything else to stop. */
  on: unknown;
  /** Whether the page may have macOS ask for the microphone: true once the Owner has read what listening means. */
  ask: unknown;
  /** Whether the window may listen (main.ts: on-device recognition on this Mac, and macOS's microphone permission, asked only when `ask`). */
  allowed: (ask: boolean) => Promise<MayListen>;
  /** Makes the window's listener (main.ts runs the speech helper); null when the window has gone. */
  listener: () => VoiceListener | null;
}

export async function listenForVoice(chats: WindowChatRepository, input: ListenForVoice): Promise<ListenAnswer> {
  const answer = (listening: Listening): ListenAnswer => ({ listening, reason: null });
  if (input.on !== true) return answer(chats.load().open.get(input.folder)?.voice?.want(false) ?? 'stopped');
  const allowed = await input.allowed(input.ask === true);
  if (allowed.may === 'unavailable') return { listening: 'unavailable', reason: allowed.reason };
  if (allowed.may !== 'allowed') return answer(allowed.may);
  const now = chats.load();
  const had = now.open.get(input.folder);
  if (had?.voice) return answer(had.voice.want(true));
  const voice = input.listener();
  if (!voice) return answer('stopped');
  // The chat keeps its place, so the page's pending patch still finds it.
  const chat = had ?? { folder: input.folder, sent: null };
  chat.voice = voice;
  const next = { ...now, open: new Map(now.open).set(input.folder, chat) };
  holdToRules(next);
  chats.save(next);
  return answer(voice.want(true));
}
