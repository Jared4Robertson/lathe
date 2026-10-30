import { useEffect, useState } from 'react';
import { Button } from '../components/Button';

// The one way a record's toolbar offers to add what sits under it (LA-PAT-APP-UX): a single "Add <kind>" button when it
// can add one kind, and one "Add…" button opening the kinds it can add when it can add several, so a page never lines
// up a row of Add buttons. It knows no kind: the editor gives the choices, their labels and what picking one does.

/** One kind the menu offers: its key, the label it is listed by ("UC requirement") and in a lone button ("UC requirement"). */
export interface AddChoice {
  key: string;
  label: string;
}

/** The Add button or menu for a record's toolbar; nothing when there is nothing to add. */
export function AddMenu({ id, choices, onPick, title = 'Add…', group = 'Kinds to add under' }: {
  /** The record it adds under, for the menu's names. */
  id: string;
  choices: readonly AddChoice[];
  onPick: (key: string) => void;
  /** The menu button's text. */
  title?: string;
  /** How the open menu is named, before the record's ID. */
  group?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [id]);
  if (choices.length === 0) return null;
  if (choices.length === 1) return <Button icon="plus" onClick={() => onPick(choices[0].key)}>Add {lowerFirst(choices[0].label)}</Button>;
  const menuId = `add-kinds-${id}-${title.replace(/\W/g, '')}`;
  return (
    <span className="record-add">
      <Button icon="plus" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>{title}</Button>
      {open && (
        <span id={menuId} className="record-add-kinds" role="group" aria-label={`${group} ${id}`}>
          {choices.map((c) => <Button key={c.key} onClick={() => { setOpen(false); onPick(c.key); }}>{c.label}</Button>)}
        </span>
      )}
    </span>
  );
}

/** A label inside a sentence: its first letter lower case, unless the label starts with an initialism (UC, API, UI). */
const lowerFirst = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
