import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { CHAT_EFFORTS, CHAT_MODELS, type ChatEffort, type ChatModel, type ModelChoice } from './types';

// The model and effort picker (LA-PLT-UC22-R03): one button under the chat's head naming the model and effort, opening a
// menu of the models Claude Code takes and of the effort levels, each with "Default" to leave the choice to Claude Code.
// Choosing starts the CLI again on the same session; it is not offered while Claude works.

const MODEL_NAME: Record<ChatModel, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };
const MODEL_DETAIL: Record<ChatModel, string> = { opus: 'The most capable; for design-heavy work.', sonnet: 'Fast and capable; for work that follows a pattern.', haiku: 'The quickest; for lookups.' };
const EFFORT_NAME: Record<ChatEffort, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max' };

/** The picker button's words: "Sonnet · High", "Opus", or "Default model". */
export function choiceLabel(choice: ModelChoice): string {
  const model = choice.model ? MODEL_NAME[choice.model] : 'Default model';
  return choice.effort ? `${model} · ${EFFORT_NAME[choice.effort]}` : model;
}

export function ModelMenu({ choice, disabled, onChoose }: { choice: ModelChoice; disabled: boolean; onChoose: (choice: ModelChoice) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);
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
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const item = (group: string, checked: boolean, name: string, detail: string | null, pick: () => void) => (
    <Button key={`${group} ${name}`} role="menuitemradio" aria-checked={checked} className="chat-mode-item" onClick={pick}>
      <span className="chat-mode-check" aria-hidden="true">{checked && <Icon name="checks" size={14} />}</span>
      <span className="chat-mode-text">
        <span className="chat-mode-item-name">{name}</span>
        {detail && <span className="chat-mode-item-detail">{detail}</span>}
      </span>
    </Button>
  );

  return (
    <div className="chat-mode chat-model">
      <Button
        ref={button}
        className="chat-mode-button chat-model-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Model and effort: ${choiceLabel(choice)}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className="chat-mode-name">{choiceLabel(choice)}</span>
        <Icon name="chevron-down" size={14} />
      </Button>
      {open && (
        <div ref={menu} id={id} className="chat-mode-menu chat-model-menu" role="menu" aria-label="Model and effort" onKeyDown={onKey}>
          <p className="chat-model-heading" role="presentation">Model</p>
          {item('model', choice.model === null, 'Default', "Whatever Claude Code's settings choose.", () => { close(); onChoose({ ...choice, model: null }); })}
          {CHAT_MODELS.map((m) => item('model', choice.model === m, MODEL_NAME[m], MODEL_DETAIL[m], () => { close(); onChoose({ ...choice, model: m }); }))}
          <p className="chat-model-heading" role="presentation">Effort</p>
          {item('effort', choice.effort === null, 'Default', "Whatever Claude Code's settings choose.", () => { close(); onChoose({ ...choice, effort: null }); })}
          {CHAT_EFFORTS.map((e) => item('effort', choice.effort === e, EFFORT_NAME[e], null, () => { close(); onChoose({ ...choice, effort: e }); }))}
        </div>
      )}
    </div>
  );
}
