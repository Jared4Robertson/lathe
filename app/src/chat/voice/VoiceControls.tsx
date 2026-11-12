import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons';
import { Tooltip } from '../../shell/Tooltip';
import { RuleBroken } from '../../shell/prefs';
import { chooseVoicePhrases } from '../../platform/voice-settings/commands/choose-voice-phrases';
import { turnQuickModeOnOrOff, turnVoiceActivationOnOrOff } from '../../platform/voice-settings/commands/handlers.generated';
import { COMMAND_LABEL, DEFAULT_COMMANDS, DEFAULT_WAKE, STRICT_WAKE } from '../../platform/voice-settings/model';
import { VOICE_COMMANDS, type VoiceCommand } from './grammar';
import type { Voice } from './useVoice';

// The chat's voice controls (LA-V99-R04): the mic button in the message box, the line above it saying what the
// chat hears (waiting for the wake phrase, dictating, Quick mode's countdown), the Voice menu under the head (voice
// activation, Quick mode, the wake phrase and the commands' words), and what the Owner reads before macOS first asks
// for the microphone.

/** The mic button: start dictating, or stop and leave the draft; disabled, saying why, once this Mac is found unable to dictate. */
export function MicButton({ voice }: { voice: Voice }) {
  const dictating = voice.view.state === 'dictating';
  const off = voice.unavailable !== null;
  const label = dictating ? 'Stop dictating' : off ? `Dictate: ${voice.unavailable}` : 'Dictate';
  return (
    <Tooltip label={voice.unavailable ?? label} command={off ? undefined : 'dictate'} placement="left">
      <Button variant="icon" label={label} aria-pressed={dictating} aria-disabled={off || undefined} className={`chat-mic is-${voice.view.state}`} onClick={voice.toggle}>
        <Icon name="mic" size={16} />
      </Button>
    </Tooltip>
  );
}

const quote = (phrase: string) => `“${phrase}”`;

/** What the chat hears now, above the message box; nothing while it does not listen. */
export function VoiceStatus({ voice }: { voice: Voice }) {
  const { view, settings } = voice;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!view.countdown) return;
    const tick = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(tick);
  }, [view.countdown]);
  let text: string | null = null;
  if (view.preparing) text = 'Preparing on-device speech recognition…';
  else if (view.countdown) text = `Sending in ${Math.max(0, (view.countdown.until - now) / 1000).toFixed(1)} s. Any key or sound cancels.`;
  else if (view.state === 'dictating') text = `Listening. Say ${quote(`${settings.wake}, ${settings.commands.send}`)} to send${settings.quick ? ', or pause when you have finished' : ''}.`;
  else if (view.state === 'waiting') text = `Listening for ${quote(settings.wake)}`;
  if (!text) return null;
  return (
    <div className={`chat-voice-status is-${view.countdown ? 'counting' : view.state}`}>
      <span className="chat-voice-dot" aria-hidden="true" />
      <span className="chat-voice-text">{text}</span>
    </div>
  );
}

/** What listening means, before macOS first asks for the microphone. */
export function VoiceIntro({ voice }: { voice: Voice }) {
  const title = useId();
  const body = useId();
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => { go.current?.focus(); }, []);
  if (!voice.intro) return null;
  return (
    <div className="chat-voice-intro" role="alertdialog" aria-labelledby={title} aria-describedby={body} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); voice.answerIntro(false); } }}>
      <p id={title} className="chat-voice-intro-title">{voice.intro === 'activation' ? 'Turn on voice activation?' : 'Talk to Claude?'}</p>
      <p id={body}>
        Lathe hears you with your Mac's own speech recognition: the audio never leaves this Mac, and nothing is recorded or saved. It listens only while this window is in front{voice.intro === 'activation' ? `, for ${quote(voice.settings.wake)} after a pause` : ''}. macOS asks next whether Lathe may use the microphone.
      </p>
      <div className="chat-warning-actions">
        <Button ref={go} variant="primary" onClick={() => voice.answerIntro(true)}>Continue</Button>
        <Button onClick={() => voice.answerIntro(false)}>Not now</Button>
      </div>
    </div>
  );
}

/** The Voice menu under the head: voice activation and Quick mode, and the phrases. */
export function VoiceMenu({ voice }: { voice: Voice }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const { settings } = voice;

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('input')?.focus();
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);
  const close = () => { setOpen(false); button.current?.focus(); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  const on = settings.activation || settings.quick;

  return (
    <div className="chat-voice">
      <Tooltip label={voice.unavailable ?? (on ? `Voice: ${[settings.activation && 'voice activation', settings.quick && 'Quick mode'].filter(Boolean).join(' and ')} on` : 'Voice')} placement="bottom">
        <Button ref={button} label={voice.unavailable === null ? 'Voice' : `Voice: ${voice.unavailable}`} className={`chat-voice-button${on ? ' is-on' : ''}`} aria-disabled={voice.unavailable !== null || undefined} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open && voice.unavailable === null)}>
          <Icon name="mic" size={14} />
          <Icon name="chevron-down" size={14} />
        </Button>
      </Tooltip>
      {open && (
        <div ref={panel} id={id} className="chat-voice-menu" role="group" aria-label="Voice" onKeyDown={onKey}>
          <label className="chat-voice-switch">
            <input type="checkbox" role="switch" checked={settings.activation} onChange={(e) => turnVoiceActivationOnOrOff({ on: e.target.checked })} />
            <span className="chat-voice-switch-text">
              <span className="chat-voice-switch-name">Voice activation</span>
              <span className="chat-voice-switch-detail">Say {quote(settings.wake)} after a pause to start a message, while this window is in front.</span>
            </span>
          </label>
          <label className="chat-voice-switch">
            <input type="checkbox" role="switch" checked={settings.quick} onChange={(e) => turnQuickModeOnOrOff({ on: e.target.checked })} />
            <span className="chat-voice-switch-text">
              <span className="chat-voice-switch-name">Quick mode</span>
              <span className="chat-voice-switch-detail">
                Send a dictated message by itself when you have finished, judged on this Mac from your words and voice.
              </span>
            </span>
          </label>
          <PhraseEditor wake={settings.wake} commands={settings.commands} />
          <p className="chat-voice-note">Speech is recognized on this Mac; audio never leaves it, and nothing is recorded or saved.</p>
        </div>
      )}
    </div>
  );
}

function PhraseEditor({ wake, commands }: { wake: string; commands: Record<VoiceCommand, string> }) {
  const [draft, setDraft] = useState({ wake, commands });
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft({ wake, commands }); }, [wake, commands]);
  const changed = draft.wake !== wake || VOICE_COMMANDS.some((c) => draft.commands[c] !== commands[c]);
  const save = () => {
    try {
      chooseVoicePhrases(draft);
      setProblems([]);
      setSaved(true);
    } catch (error) {
      if (!(error instanceof RuleBroken)) throw error;
      setProblems(error.problems.map((p) => p.message));
    }
  };
  const edit = (next: typeof draft) => { setDraft(next); setSaved(false); };
  return (
    <form className="chat-voice-phrases" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="chat-voice-field">
        <label htmlFor="chat-voice-wake">Wake phrase</label>
        <div className="chat-voice-wake">
          <input id="chat-voice-wake" value={draft.wake} onChange={(e) => edit({ ...draft, wake: e.target.value })} />
          <Button onClick={() => edit({ ...draft, wake: draft.wake === STRICT_WAKE ? DEFAULT_WAKE : STRICT_WAKE })}>
            {draft.wake === STRICT_WAKE ? `Use ${quote(DEFAULT_WAKE)}` : `Use ${quote(STRICT_WAKE)}`}
          </Button>
        </div>
      </div>
      <p className="chat-voice-note">Commands: a pause, the wake phrase, then the command's words.</p>
      {VOICE_COMMANDS.map((c) => (
        <div key={c} className="chat-voice-field is-command">
          <label htmlFor={`chat-voice-${c}`}>{COMMAND_LABEL[c]}</label>
          <input id={`chat-voice-${c}`} value={draft.commands[c]} placeholder={DEFAULT_COMMANDS[c]} onChange={(e) => edit({ ...draft, commands: { ...draft.commands, [c]: e.target.value } })} />
        </div>
      ))}
      {problems.length > 0 && <ul className="chat-voice-problems" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="chat-voice-actions">
        <Button type="submit" variant="primary" disabled={!changed}>Save phrases</Button>
        <span className="chat-voice-saved" role="status">{saved && !changed ? 'Saved' : ''}</span>
      </div>
    </form>
  );
}
