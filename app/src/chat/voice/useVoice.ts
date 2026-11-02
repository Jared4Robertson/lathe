import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { turnVoiceActivationOnOrOff } from '../../platform/voice-settings/commands/handlers.generated';
import { DEFAULT_VOICE_SETTINGS, phrasesOf, type VoiceSettings } from '../../platform/voice-settings/model';
import { useVoiceSettings } from '../../platform/voice-settings/use-voice-settings';
import { chatDraft } from '../draft';
import type { VoiceBridge, VoiceSupport } from '../types';
import { Dictation, type DictationSettings, type DictationView } from './dictation';

// The window's voice (LA-PLT-UC20): one Dictation for the window, mounted with the app (voice activation
// wakes the chat while it is hidden), fed what the shell hears (desktop/src/voice.ts). The chat panel reads it
// through VoiceContext: the mic button, the voice settings and Quick mode's countdown. The first time, before macOS
// asks for the microphone, the panel says what listening means (`intro`).

export interface Voice {
  support: VoiceSupport;
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

const dictationSettings = (settings: VoiceSettings, support: VoiceSupport | null): DictationSettings => ({
  activation: settings.activation && !!support?.available,
  quick: settings.quick,
  phrases: phrasesOf(settings),
  endOfTurn: support?.endOfTurn ?? false,
});

/** The window's voice, or null where it cannot dictate (the button is then not shown). */
export function useWindowVoice(bridge: VoiceBridge | null, wake: () => void, say: (message: string) => void): Voice | null {
  const settings = useVoiceSettings();
  const [support, setSupport] = useState<VoiceSupport | null>(null);
  const [view, setView] = useState<DictationView>({ state: 'off', countdown: null, preparing: false });
  const [intro, setIntro] = useState<Voice['intro']>(null);
  const dictation = useRef<Dictation | null>(null);
  const send = useRef<((text: string) => void) | null>(null);
  const hooks = useRef({ wake, say });
  hooks.current = { wake, say };

  useEffect(() => { if (bridge) void bridge.support().then(setSupport, () => setSupport(null)); }, [bridge]);

  // The microphone is asked for only after the Owner has read what listening means.
  const unasked = support?.microphone === 'not-determined';
  const [introDone, setIntroDone] = useState(false);
  const held = settings.activation && unasked && !introDone;

  useEffect(() => {
    if (!bridge || !support?.available) return;
    const d = new Dictation({
      readDraft: chatDraft.read,
      writeDraft: chatDraft.write,
      send: (text) => { if (send.current) send.current(text); },
      wake: () => hooks.current.wake(),
      listen: (on) => {
        void bridge.listen(on).then((result) => {
          if (result === 'denied') hooks.current.say('Lathe may not use the microphone. Allow it in System Settings › Privacy & Security › Microphone.');
          else if (result === 'unavailable') hooks.current.say('Dictation is not available.');
          if (on && (result === 'denied' || result === 'unavailable')) d.stop();
          if (result === 'denied') void bridge.support().then(setSupport);
        });
      },
      say: (message) => hooks.current.say(message),
      changed: setView,
    }, dictationSettings(DEFAULT_VOICE_SETTINGS, support));
    dictation.current = d;
    const off = bridge.onEvent((event) => d.event(event));
    // Any key cancels Quick mode's countdown.
    const onKey = () => d.key();
    window.addEventListener('keydown', onKey, true);
    return () => { off(); window.removeEventListener('keydown', onKey, true); d.dispose(); dictation.current = null; };
  }, [bridge, support]);

  const activation = settings.activation && !held;
  useEffect(() => { dictation.current?.configure(dictationSettings({ ...settings, activation }, support)); }, [settings, activation, support]);

  useEffect(() => { if (held) setIntro((was) => was ?? 'activation'); }, [held]);

  const toggle = useCallback(() => {
    if (!dictation.current) return;
    if (unasked && !introDone && dictation.current.state !== 'dictating') { setIntro('dictate'); return; }
    dictation.current.toggle();
  }, [unasked, introDone]);

  const answerIntro = useCallback((go: boolean) => {
    const was = intro;
    setIntro(null);
    if (!go) { if (was === 'activation') turnVoiceActivationOnOrOff({ on: false }); return; }
    setIntroDone(true);
    if (was === 'dictate') setTimeout(() => dictation.current?.toggle(), 0);
  }, [intro]);

  const sendWith = useCallback((next: ((text: string) => void) | null) => { send.current = next; }, []);

  return useMemo(() => (support?.available ? { support, view, settings, toggle, intro, answerIntro, sendWith } : null), [support, view, settings, toggle, intro, answerIntro, sendWith]);
}
