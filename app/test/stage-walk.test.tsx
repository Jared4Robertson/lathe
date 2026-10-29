import './graph/setup';
import { Suspense, use } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandsProvider, useCommand, useRunCommand } from '../src/shell/commands';
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
    // Quick find (a combobox) and the nav tree keep their arrows.
    const find = document.querySelector<HTMLInputElement>('#nav input')!;
    find.focus();
    press(find, 'ArrowLeft');
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

/** A stage that answers Frame the focus while it is shown. */
function FitStage({ onFit }: { onFit: () => void }) {
  useCommand('graphFit', onFit);
  return <p>stage</p>;
}
/** The next stage's code, loading until the promise settles. */
function NextStage({ loading }: { loading: Promise<void> | null }) {
  if (loading) use(loading);
  return null;
}
let runCommand: (id: string) => boolean = () => false;
function Runner() {
  runCommand = useRunCommand();
  return null;
}
const stages = (onFit: () => void, loading: Promise<void> | null) => (
  <CommandsProvider>
    <Suspense fallback={<p>Loading…</p>}>
      <FitStage onFit={onFit} />
      <NextStage loading={loading} />
    </Suspense>
    <Runner />
  </CommandsProvider>
);

describe('a hidden stage', () => {
  it('LA-V64-R01-T02 A stage Suspense hides while the next one loads stops answering its commands at once, and answers again once shown', async () => {
    const onFit = vi.fn();
    const { rerender } = render(stages(onFit, null));
    act(() => { expect(runCommand('graphFit')).toBe(true); });
    expect(onFit).toHaveBeenCalledTimes(1);

    // The next stage suspends: React hides this one and keeps it mounted, its passive effects included.
    let settle: () => void = () => {};
    const loading = new Promise<void>((r) => { settle = r; });
    rerender(stages(onFit, loading));
    await waitFor(() => expect(screen.getByText('Loading…')).toBeInTheDocument());
    expect(screen.getByText('stage')).not.toBeVisible();
    act(() => { expect(runCommand('graphFit')).toBe(false); });
    expect(onFit).toHaveBeenCalledTimes(1);

    // Loaded, it shows and answers again.
    await act(async () => { settle(); await loading; });
    rerender(stages(onFit, null));
    await waitFor(() => expect(screen.getByText('stage')).toBeVisible());
    act(() => { expect(runCommand('graphFit')).toBe(true); });
    expect(onFit).toHaveBeenCalledTimes(2);
  });
});
