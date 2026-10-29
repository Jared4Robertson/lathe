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
  it('LA-V61-R49-T02 From the page the plain arrows walk the Graph, ERD and Trace stages and are announced, and stay with quick find and the Trace table, but not with a nav link clicked last', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .graph-box')).not.toBeNull());
    await walksOutAndIn(() => document.body);

    // A modifier keeps the arrow's own meaning: nothing steps.
    press(document.body, 'ArrowLeft', { altKey: true });
    // Quick find (a combobox in a modal dialog) keeps its arrows.
    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ctrlKey: true });
    const find = document.querySelector<HTMLInputElement>('.quick-open input')!;
    expect(find).toHaveFocus();
    press(find, 'ArrowLeft');
    press(find, 'ArrowDown');
    fireEvent.keyDown(find, { key: 'Escape' });
    expect(document.querySelector('.quick-open')).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');
    // The nav's links don't use arrows: with one focused (the record just clicked in the nav), the arrows walk the stage.
    const navLink = document.querySelector<HTMLElement>('#nav .space-items a')!;
    navLink.focus();
    await walksOutAndIn(() => navLink);

    // The ERD stage walks by the picture: from the use case, which picks out no box, its domain's region; Right to the
    // region beside it, Left back. Back in history to the use case for the next stage.
    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(document.querySelector('.focus-stage[data-stage="erd"] .react-flow__node')).not.toBeNull());
    press(document.body, 'ArrowLeft');
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');
    press(document.body, 'ArrowRight');
    await waitFor(() => expect(at()).toBe('/P-E'));
    await waitFor(() => expect(announcer()).toHaveTextContent('Domain Accounts'));
    press(document.body, 'ArrowLeft');
    await waitFor(() => expect(at()).toBe('/P-D'));
    await waitFor(() => expect(announcer()).toHaveTextContent('Domain Domain'));
    window.history.go(-2);
    await waitFor(() => expect(at()).toBe('/P-D-UC01'));

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

const letter = (target: Element, l: string, mods: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(target, { key: mods.shiftKey ? l.toUpperCase() : l, code: `Key${l.toUpperCase()}`, ...mods });
const card = () => screen.queryByRole('region', { name: 'Wiki card' });

describe('the walking letters', () => {
  it('LA-V61-R49-T06 W, A, S and D walk the Graph, ERD and Trace stages as the arrows do, plain only, and stay with a text field', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .graph-box')).not.toBeNull());
    // The Tree view: A out to the capability, D back in, each announced.
    letter(document.body, 'a');
    await waitFor(() => expect(at()).toBe('/P-D-CAP01'));
    await waitFor(() => expect(announcer()).toHaveTextContent('Capability Lending'));
    letter(document.body, 'd');
    await waitFor(() => expect(at()).toBe('/P-D-UC01'));
    // With Ctrl, Alt or Shift held, the letter keeps its own meaning: nothing steps, and the card stays.
    letter(document.body, 'a', { shiftKey: true });
    letter(document.body, 'a', { altKey: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');
    expect(card()).not.toBeNull();
    // In a text field a letter is typed, never walked.
    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ctrlKey: true });
    const find = document.querySelector<HTMLInputElement>('.quick-open input')!;
    letter(find, 'a');
    letter(find, 'w');
    fireEvent.keyDown(find, { key: 'Escape' });
    await new Promise((r) => setTimeout(r, 50));
    expect(at()).toBe('/P-D-UC01');

    // The ERD by the picture, as Right and Left: D to the region beside the use case's domain.
    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(document.querySelector('.focus-stage[data-stage="erd"] .react-flow__node')).not.toBeNull());
    letter(document.body, 'd');
    await waitFor(() => expect(at()).toBe('/P-E'));
    window.history.back();
    await waitFor(() => expect(at()).toBe('/P-D-UC01'));

    // The Trace stage, by the Tree view's keys.
    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(document.querySelector('.focus-stage[data-stage="trace"] .trace-page')).not.toBeNull());
    letter(document.body, 'a');
    await waitFor(() => expect(at()).toBe('/P-D-CAP01'));
    letter(document.body, 'd');
    await waitFor(() => expect(at()).toBe('/P-D-UC01'));
  });
});

describe('Enter and Escape on the stage', () => {
  it('LA-V96-R19-T06 Enter toggles the wiki card from the page and the focused box, focuses another box, stays with a button; Escape collapses it after what is above it', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .graph-box')).not.toBeNull());
    expect(card()).not.toBeNull();
    // From the page, Enter collapses the card and opens it again; focus stays where it was.
    press(document.body, 'Enter');
    expect(card()).toBeNull();
    press(document.body, 'Enter');
    expect(card()).not.toBeNull();

    // On the focus's own box, Enter toggles the card; on another box it focuses that box, the card left alone.
    const box = (id: string) => document.querySelector<HTMLElement>(`.focus-stage .graph-box[data-id="${id}"]`)!;
    box('P-D-UC01').focus();
    press(box('P-D-UC01'), 'Enter');
    expect(card()).toBeNull();
    expect(box('P-D-UC01')).toHaveFocus();
    press(box('P-D-UC01'), 'Enter');
    expect(card()).not.toBeNull();
    box('P-D-CAP01').focus();
    press(box('P-D-CAP01'), 'Enter');
    await waitFor(() => expect(at()).toBe('/P-D-CAP01'));
    expect(card()).not.toBeNull();

    // A button keeps its Enter: the stage switch's Graph button is its own, never the card's.
    const button = stageButton('Graph');
    button.focus();
    press(button, 'Enter');
    expect(card()).not.toBeNull();

    // Escape closes the topmost thing first: quick find, then the card; a second Escape with the card gone does nothing.
    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ctrlKey: true });
    const find = document.querySelector<HTMLInputElement>('.quick-open input')!;
    press(find, 'Escape');
    expect(document.querySelector('.quick-open')).toBeNull();
    expect(card()).not.toBeNull();
    press(document.body, 'Escape');
    expect(card()).toBeNull();
    press(document.body, 'Escape');
    expect(card()).toBeNull();
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
