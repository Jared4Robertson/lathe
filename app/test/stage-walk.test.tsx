import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { modelWorkspace } from './fixtures/model';
import { openApp } from './helpers';

// The arrow keys walk the stage from anywhere (LA-V61-R49): one handler in the commands layer sends a plain arrow to the
// shown stage's walk, unless keyboard focus is in a control that uses arrows itself.

const announcer = () => screen.getByTestId('announcer');
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const at = () => decodeURIComponent(window.location.pathname);
const press = (target: Element, key: string, mods: { altKey?: boolean } = {}) => fireEvent.keyDown(target, { key, code: key, ...mods });

/** Left steps from the use case out to its capability and Right back in to it, by the Tree view's keys, each announced. */
async function walksOutAndIn(target: () => Element) {
  press(target(), 'ArrowLeft');
  await waitFor(() => expect(at()).toBe('/P-D-CAP01'));
  await waitFor(() => expect(announcer()).toHaveTextContent('Capability Lending'));
  press(target(), 'ArrowRight');
  await waitFor(() => expect(at()).toBe('/P-D-UC01'));
  await waitFor(() => expect(announcer()).toHaveTextContent('Use case Lend a thing'));
}

describe('the stage walk', () => {
  it('LA-V61-R49-T02 From the page the plain arrows walk the Graph, ERD and Trace stages and are announced, and stay with quick find, the nav tree and the Trace table', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .graph-box')).not.toBeNull());
    await walksOutAndIn(() => document.body);

    // A modifier keeps the arrow's own meaning: nothing steps.
    press(document.body, 'ArrowLeft', { altKey: true });
    // Quick find (a combobox in a modal dialog) and the nav tree keep their arrows.
    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ctrlKey: true });
    const find = document.querySelector<HTMLInputElement>('.quick-open input')!;
    expect(find).toHaveFocus();
    press(find, 'ArrowLeft');
    press(find, 'ArrowDown');
    fireEvent.keyDown(find, { key: 'Escape' });
    expect(document.querySelector('.quick-open')).toBeNull();
    const navLink = document.querySelector<HTMLElement>('#nav .space-items a')!;
    navLink.focus();
    press(navLink, 'ArrowLeft');
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');

    // The ERD stage walks by the Tree view's keys.
    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(document.querySelector('.focus-stage[data-stage="erd"] .erd-page')).not.toBeNull());
    await walksOutAndIn(() => document.body);

    // So does the Trace stage; a link of its table, the accessible layer under the canvas, keeps its own arrows.
    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(document.querySelector('.focus-stage[data-stage="trace"] .trace-page')).not.toBeNull());
    await walksOutAndIn(() => document.body);
    const link = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.trace-access a[data-trace-id]');
      expect(el).not.toBeNull();
      return el!;
    });
    link.focus();
    press(link, 'ArrowLeft');
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');
  });
});
