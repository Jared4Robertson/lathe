import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

// A quick pick, as VS Code's: a filter box over a list. Arrowing moves through the list and shows
// each item at once (onActive); Enter or a click keeps it; Escape or a click outside puts back
// what was there before (onCancel), and focus goes back where it was.

export interface PickItem {
  id: string;
  text: string;
  detail?: string;
  icon?: ReactNode;
}

interface Props {
  label: string;
  placeholder: string;
  items: readonly PickItem[];
  current: string;
  onActive: (id: string) => void;
  onPick: (id: string) => void;
  onCancel: () => void;
}

export function QuickPick({ label, placeholder, items, current, onActive, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => !q || i.text.toLowerCase().includes(q) || i.detail?.toLowerCase().includes(q));
  const [activeId, setActiveId] = useState(current);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const at = Math.max(0, shown.findIndex((i) => i.id === activeId));

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, []);

  const move = (to: number) => {
    const item = shown[(to + shown.length) % shown.length];
    if (!item) return;
    setActiveId(item.id);
    onActive(item.id);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); move(0); }
    else if (e.key === 'End') { e.preventDefault(); move(shown.length - 1); }
    else if (e.key === 'Enter' && shown[at]) { e.preventDefault(); onPick(shown[at].id); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    else if (e.key === 'Tab') e.preventDefault();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog palette" role="dialog" aria-modal="true" aria-label={label}>
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown[at] ? `${listId}-${shown[at].id}` : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          className="dialog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul id={listId} role="listbox" aria-label={label} className="palette-list">
          {shown.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={i === at}
              className={i === at ? 'active' : undefined}
              onMouseDown={(e) => { e.preventDefault(); onPick(item.id); }}
            >
              <span className="palette-title pick-label">{item.icon}{item.text}</span>
              {item.detail && <span className="pick-detail">{item.detail}</span>}
            </li>
          ))}
          {shown.length === 0 && <li className="hint" role="presentation">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
