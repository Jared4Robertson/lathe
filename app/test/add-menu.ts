import { within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { lowerLabel } from '../src/plural';

// A record's toolbar offers the kinds it can add through one Add… menu when it can add several, and one "Add <kind>"
// button when it can add one (app/src/edit/AddMenu.tsx).


/** Adds a kind from the toolbar: through its Add… menu when it offers several kinds, else its one Add button. */
export async function chooseAdd(user: UserEvent, toolbar: HTMLElement, label: string) {
  const menu = within(toolbar).queryByRole('button', { name: 'Add…' });
  if (!menu) { await user.click(within(toolbar).getByRole('button', { name: `Add ${lowerLabel(label)}` })); return; }
  if (menu.getAttribute('aria-expanded') !== 'true') await user.click(menu);
  await user.click(within(within(toolbar).getByRole('group', { name: /^Kinds to add under / })).getByRole('button', { name: label }));
}

/** The kinds the toolbar's Add… menu offers, by their labels, opening it when it is closed. */
export async function addChoices(user: UserEvent, toolbar: HTMLElement): Promise<string[]> {
  const menu = within(toolbar).getByRole('button', { name: 'Add…' });
  if (menu.getAttribute('aria-expanded') !== 'true') await user.click(menu);
  return within(within(toolbar).getByRole('group', { name: /^Kinds to add under / })).getAllByRole('button').map((b) => b.textContent ?? '');
}
