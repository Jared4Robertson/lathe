import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { turnVoiceActivationOnOrOff } from '../../platform/voice-settings/commands/handlers.generated';
import { DEFAULT_VOICE_SETTINGS, phrasesOf, type VoiceSettings } from '../../platform/voice-settings/model';
import { useVoiceSettings } from '../../platform/voice-settings/use-voice-settings';
import { chatDraft } from '../draft';
import type { VoiceBridge } from '../types';
import { Dictation, type DictationSettings, type DictationView } from './dictation';

// The window's voice (LA-PLT-UC20): one Dictation for the window, mounted with the app (voice activation
// wakes the chat while it is hidden), fed what the shell hears (desktop/src/voice.ts). The chat panel reads it
// through VoiceContext: the mic button, the voice settings and Quick mode's countdown. The desktop window offers the
// mic; the shell's answer to listening says whether this Mac can dictate, and when it cannot, why: the reason is said,
// and the window's mic and Voice menu are then disabled with it. The first time, before macOS asks for the
// microphone, the shell answers unasked and the panel says what listening means (`intro`); only once the Owner goes
// on may macOS ask.

export interface Voice {
  /** Why this Mac cannot dictate, once listening was refused for it; null while it may. */
  unavailable: string | null;
  view: DictationView;
  settings: VoiceSettings;
  /** Start dictating, or stop and leave the draft (the mic button and its key). */
  toggle: () => void;
  /** What waits on the Owner's go-ahead before macOS asks for the microphone, the first time: null when nothing does. */
  intro: 'dictate' | 'activation' | null;
  answerIntro: (go: boolean) => void;
  /** The panel's send, which dictation calls with the message ("Lathe, send", or Quick mode). */
  sendWith: (send: ((text: string) => void) | null) => void;
}

export const VoiceContext = createContext<Voice | null>(null);
export const useVoice = () => useContext(VoiceContext);

/** What dictation reads of the settings: voice activation only while the Mac may dictate and nothing waits on the Owner. */
const dictationSettings = (settings: VoiceSettings, activation: boolean): DictationSettings => ({
  activation,
  quick: settings.quick,
  phrases: phrasesOf(settings),
});

/** The window's voice, or null outside the desktop app (the mic is then not offered). */
export function useWindowVoice(bridge: VoiceBridge | null, wake: () => void, say: (message: string) => void): Voice | null {
  const settings = useVoiceSettings();
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [view, setView] = useState<DictationView>({ state: 'off', countdown: null, preparing: false });
  const [intro, setIntro] = useState<Voice['intro']>(null);
  const dictation = useRef<Dictation | null>(null);
  const send = useRef<((text: string) => void) | null>(null);
  const hooks = useRef({ wake, say });
  hooks.current = { wake, say };
  // Whether macOS may ask for the microphone: once the Owner has read what listening means.
  const mayAsk = useRef(false);
  const [held, setHeld] = useState(false);
  const activation = settings.activation && unavailable === null && !held;
  const activationNow = useRef(activation);
  activationNow.current = activation;

  useEffect(() => {
    if (!bridge) return;
    const d = new Dictation({
      readDraft: chatDraft.read,
      writeDraft: chatDraft.write,
      send: (text) => { if (send.current) send.current(text); },
      wake: () => hooks.current.wake(),
      listen: (on) => {
        void bridge.listen(on, mayAsk.current).then(({ listening, reason }) => {
          if (!on) return;
          if (listening === 'unasked') {
            setHeld(true);
            // Asked for dictating, the intro is about dictating; asked by voice activation, about it, unless one shows already.
            if (d.state === 'dictating') setIntro('dictate');
            else setIntro((was) => was ?? 'activation');
          } else if (listening === 'denied') hooks.current.say('Lathe may not use the microphone. Allow it in System Settings › Privacy & Security › Microphone.');
          else if (listening === 'unavailable') {
            const why = reason ?? 'Dictation is not available.';
            setUnavailable(why);
            hooks.current.say(why);
          }
          if (listening === 'unasked' || listening === 'denied' || listening === 'unavailable') d.stop();
        });
      },
      say: (message) => hooks.current.say(message),
      changed: setView,
    }, dictationSettings(DEFAULT_VOICE_SETTINGS, activationNow.current));
    dictation.current = d;
    const off = bridge.onEvent((event) => d.event(event));
    // Any key cancels Quick mode's countdown.
    const onKey = () => d.key();
    window.addEventListener('keydown', onKey, true);
    return () => { off(); window.removeEventListener('keydown', onKey, true); d.dispose(); dictation.current = null; };
  }, [bridge]);

  useEffect(() => { dictation.current?.configure(dictationSettings(settings, activation)); }, [settings, activation]);

  const toggle = useCallback(() => {
    if (!dictation.current || unavailable !== null) return;
    dictation.current.toggle();
  }, [unavailable]);

  const answerIntro = useCallback((go: boolean) => {
    const was = intro;
    setIntro(null);
    if (!go) {
      setHeld(false);
      if (was === 'activation') turnVoiceActivationOnOrOff({ on: false });
      return;
    }
    mayAsk.current = true;
    setHeld(false);
    if (was === 'dictate') setTimeout(() => dictation.current?.toggle(), 0);
  }, [intro]);

  const sendWith = useCallback((next: ((text: string) => void) | null) => { send.current = next; }, []);

  return useMemo(() => (bridge ? { unavailable, view, settings, toggle, intro, answerIntro, sendWith } : null), [bridge, unavailable, view, settings, toggle, intro, answerIntro, sendWith]);
}
