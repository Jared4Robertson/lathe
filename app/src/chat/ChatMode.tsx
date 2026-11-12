import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { CHAT_MODES, type ChatMode } from './types';

// The chat's permission mode control (LA-V99-R03, LA-PLT-UC45-R01): one button under the chat's head naming the
// mode, opening a menu of the five, each with what it lets Claude do. Bypass asks first, with a clear warning
// (BypassWarning), and shows a badge in the head while it is on (ChatPanel).

export const MODE_INFO: Record<ChatMode, { name: string; detail: string }> = {
  ask: { name: 'Ask', detail: 'Claude asks before every tool it uses, reads included.' },
  'accept-reads': { name: 'Accept reads', detail: "Claude reads the spec and the folder without asking, and asks before anything else." },
  auto: { name: 'Auto', detail: "Claude Code's auto mode decides what needs asking." },
  bypass: { name: 'Bypass', detail: 'Nothing asks: Claude uses every tool, writes and commands included.' },
  'view-only': { name: 'View only', detail: 'Claude only reads: nothing in the spec or the folder can change.' },
};

export function ChatModeMenu({ mode, disabled, onChoose }: { mode: ChatMode; disabled: boolean; onChoose: (mode: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ChatMode>(mode);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(`[data-mode="${active}"]`)?.focus();
  }, [open, active]);

  // A click outside closes the menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (next: ChatMode) => {
    close();
    if (next !== mode) onChoose(next);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = CHAT_MODES.indexOf(active);
    const to = (n: number) => { e.preventDefault(); setActive(CHAT_MODES[(n + CHAT_MODES.length) % CHAT_MODES.length]); };
    if (e.key === 'ArrowDown') to(at + 1);
    else if (e.key === 'ArrowUp') to(at - 1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(CHAT_MODES.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  return (
    <div className="chat-mode">
      <Button
        ref={button}
        className={`chat-mode-button is-${mode}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Permission mode: ${MODE_INFO[mode].name}`}
        disabled={disabled}
        onClick={() => { setActive(mode); setOpen(!open); }}
      >
        <span className="chat-mode-name">{MODE_INFO[mode].name}</span>
        <Icon name="chevron-down" size={14} />
      </Button>
      {open && (
        <div ref={menu} id={id} className="chat-mode-menu" role="menu" aria-label="Permission mode" onKeyDown={onKey}>
          {CHAT_MODES.map((m) => (
            <Button
              key={m}
              role="menuitemradio"
              aria-checked={m === mode}
              data-mode={m}
              tabIndex={m === active ? 0 : -1}
              className={`chat-mode-item is-${m}`}
              onFocus={() => setActive(m)}
              onClick={() => choose(m)}
            >
              <span className="chat-mode-check" aria-hidden="true">{m === mode && <Icon name="checks" size={14} />}</span>
              <span className="chat-mode-text">
                <span className="chat-mode-item-name">{MODE_INFO[m].name}</span>
                <span className="chat-mode-item-detail">{MODE_INFO[m].detail}</span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The warning before Bypass is turned on. */
export function BypassWarning({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const title = useId();
  const body = useId();
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => { confirm.current?.focus(); }, []);
  return (
    <div className="chat-bypass-warning" role="alertdialog" aria-labelledby={title} aria-describedby={body} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}>
      <p id={title} className="chat-bypass-title">Turn on Bypass?</p>
      <p id={body}>
        Claude will use every tool without asking you: it can change or remove the spec, edit and delete files in this folder, and run commands. Choose it only for work you would let Claude do unwatched.
      </p>
      <div className="chat-warning-actions">
        <Button ref={confirm} danger onClick={onConfirm}>Turn on Bypass</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
