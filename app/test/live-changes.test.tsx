import type { ServedData } from './read-view';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BaselineAnswer } from '../../lathe/src/server/contract';
import { SETTINGS_KEY } from '../src/exploring/session-settings/repository';
import { setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { openApp, serve, startAtDepth, type Served } from './helpers';
import './graph/setup';
import { drawnBox, scene } from './graph/scene';
import { erdBox, erdDrawn } from './erd-scene';

// Watching the spec change (LA-EXP-UC15): the data reloads as the server reports a change (an Agent through the CLI
// or MCP, a git pull, the Reader), the stages mark what changed, and Highlight changes, the Changes panel and the wiki
// card compare the data with a baseline the server reads from git (stood in for here by `baseline`).

const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock('../src/events', () => ({
  onLatheEvent: (event: string, callback: () => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    return () => listeners.get(event)!.delete(callback);
  } }));

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
/** The baselines: the fixture as it was committed, for the last commit, where the branch left main and a noted commit. */
function baselines(asked: string[] = []): NonNullable<Served['baseline']> {
  const committed = workspace().sources[0].tables;
  return (since): BaselineAnswer => {
    asked.push(since);
    const commit = since === 'branch' ? BASE : since === 'commit' ? HEAD : since;
    return { state: 'ok', commit, short: commit.slice(0, 7), subject: since === 'branch' ? 'Start the shop' : 'Add the basket', date: '2026-10-27T10:00:00Z', base: since === 'branch' ? 'main' : null, tables: committed };
  };
}

/** The fixture with the command renamed and a new one beside it: what an Agent writes. */
function agentEdits(data: ServedData = workspace()): ServedData {
  const next = setRow(data, 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' });
  next.sources[0].tables.command.push({ id: 'DM-SHOP-CMD09', title: 'Empty basket', entity_id: 'DM-SHOP-EN01' });
  return next;
}

/** The data without one command. */
function withoutCommand(data: ServedData, id: string): ServedData {
  const commands = data.sources[0].tables.command;
  commands.splice(commands.findIndex((r) => r.id === id), 1);
  return data;
}

/** The server reports a change and serves the new data; the page reloads it. */
async function land(data: ServedData, asked?: string[]) {
  serve({ data, baseline: baselines(asked) });
  await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });
}

const tools = () => screen.getByRole('group', { name: 'Changes' });
const panel = () => screen.getByRole('region', { name: 'Changes' });
const card = () => screen.getByRole('region', { name: 'Wiki card' });
const settings = () => JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY) ?? '{}');
const count = () => within(tools()).getByRole('button', { name: /^Changes \d/ });

async function openAt(path: string, asked?: string[]) {
  const opened = await openApp(path, { baseline: baselines(asked) });
  await screen.findByRole('group', { name: 'Changes' });
  return opened;
}

describe('LA-EXP-UC15 the Reader watches the spec change', () => {
  it('LA-EXP-UC15-R02-T01 Live marks on every stage as the data reloads: new and changed boxes marked, a removed one\'s ghost, dots only under reduced motion', async () => {
    startAtDepth(3);
    await openAt('/DM-SHOP-A1');
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD01')).toBeDefined());
    expect(drawnBox('DM-SHOP-CMD01')!.change).toBeNull();
    await land(agentEdits());
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD01')?.change).toBe('changed'));
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')?.change).toBe('added'));
    // A command added and then removed was never there; a record that was there leaves a ghost where it was.
    await land(withoutCommand(agentEdits(), 'DM-SHOP-CMD09'));
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')).toBeUndefined());
    expect(scene().ghosts).not.toContain('DM-SHOP-CMD09');
    await land(withoutCommand(agentEdits(), 'DM-SHOP-CMD01'));
    await waitFor(() => expect(scene().ghosts).toContain('DM-SHOP-CMD01'));
  });

  it('LA-EXP-UC15-R03-T01 Highlight changes dims everything unchanged, against the last commit, where the branch left main, or the moment the Reader last looked', async () => {
    const asked: string[] = [];
    await openAt('/DM-SHOP-CMD01', asked);
    await land(agentEdits(), asked);
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    fireEvent.click(within(tools()).getByRole('button', { name: 'Highlight changes' }));
    expect(within(tools()).getByRole('button', { name: 'Highlight changes' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD01')?.strength).toBe(1));
    const unchanged = scene().boxes.filter((b) => !['DM-SHOP-CMD01', 'DM-SHOP-CMD09'].includes(b.id));
    expect(unchanged.length).toBeGreaterThan(0);
    expect(unchanged.every((b) => b.strength < 1)).toBe(true);

    const picker = within(tools()).getByRole('combobox', { name: 'Compared with' });
    fireEvent.change(picker, { target: { value: 'branch' } });
    await waitFor(() => expect(asked).toContain('branch'));
    expect(settings().since).toBe('branch');
    // Since I last looked: the moment the Reader entered the product, the commit it was on and each record's digest then.
    expect(settings().looked.DM).toMatchObject({ commit: HEAD });
    fireEvent.change(picker, { target: { value: 'looked' } });
    await waitFor(() => expect(asked).toContain(HEAD));
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    // Dismissing Highlight changes is looking: nothing has changed since.
    const before = settings().looked.DM.at;
    fireEvent.click(within(tools()).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(() => expect(settings().looked.DM.at).not.toBe(before));
    await waitFor(() => expect(count()).toHaveTextContent('0'));
    // The look keeps each record's digest then, the new command among them.
    expect(Object.keys(settings().looked.DM.digests)).toEqual(expect.arrayContaining(['DM-SHOP-CMD01', 'DM-SHOP-CMD09']));
  });

  it('LA-EXP-UC15-R07-T02 With Highlight changes on, the Graph\'s boxes carry their pill and each container its roll-up, and the nav shows the counts', async () => {
    startAtDepth(3);
    await openAt('/DM-SHOP-A1');
    await land(agentEdits());
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    // Off: no pills and no roll-ups.
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD01')).toBeDefined());
    expect(drawnBox('DM-SHOP-CMD01')!.pill).toBeNull();
    expect(document.querySelector('.space-items .nav-changes')).toBeNull();
    fireEvent.click(within(tools()).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')?.pill).toBe('added'));
    expect(drawnBox('DM-SHOP-CMD01')!.pill).toBe('changed');
    // The unchanged are dimmed to a fifth.
    expect(drawnBox('DM-SHOP-A1')!.strength).toBeCloseTo(0.2);
    // The container of both holds their roll-up; one that holds neither has none.
    expect(drawnBox('DM-SHOP-EN01')!.rollup).toBe('1 new · 1 changed');
    expect(drawnBox('DM-SHOP-A1')!.rollup).toBe('1 new · 1 changed');
    expect(drawnBox('DM-SHOP-CMD01')!.rollup).toBeNull();
    // The nav counts them beside the domain, with the words for a screen reader.
    await waitFor(() => expect([...document.querySelectorAll('.space-items .nav-changes')].map((e) => e.getAttribute('title'))).toContain('1 new · 1 changed'));
  });

  it('LA-V96-R36-T01 The Graph\'s containers show their roll-ups, the nav its counts, and the minimap and the edge hints point to changes out of view', async () => {
    startAtDepth(3);
    await openAt('/DM-SHOP-A1');
    await land(agentEdits());
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    fireEvent.click(within(tools()).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(() => expect(drawnBox('DM-SHOP-EN01')?.rollup).toBe('1 new · 1 changed'));
    await waitFor(() => expect([...document.querySelectorAll('.space-items .nav-changes')].map((e) => e.getAttribute('title'))).toContain('1 new · 1 changed'));
  });

  it('LA-EXP-UC15-R09-T02 ] and [ move the focus to the next and previous changed record and announce it', async () => {
    await openAt('/DM-SHOP-A1');
    await land(agentEdits());
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    const press = (key: string) => fireEvent.keyDown(document.body, { key });
    press(']');
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(await screen.findByText(/Next change: Put item in basket, changed, 1 of 2/)).toBeInTheDocument();
    press(']');
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD09'));
    press('[');
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(await screen.findByText(/Previous change: Put item in basket, changed, 1 of 2/)).toBeInTheDocument();
  });

  it('LA-EXP-UC15-R03-T02 A record removed that the baseline had leaves only its ghost; one new since the baseline and then removed leaves nothing', async () => {
    startAtDepth(3);
    // The page opens with CMD09 already added since the baseline (the fixture as committed has only CMD01).
    const opened = await openApp('/DM-SHOP-A1', { data: agentEdits(), baseline: baselines() });
    expect(opened).toBeDefined();
    await screen.findByRole('group', { name: 'Changes' });
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')).toBeDefined());
    fireEvent.click(within(tools()).getByRole('button', { name: 'Highlight changes' }));
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')?.pill).toBe('added'));
    // It never existed at the baseline: removing it leaves no box and no ghost.
    await land(withoutCommand(agentEdits(), 'DM-SHOP-CMD09'));
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD09')).toBeUndefined());
    expect(scene().ghosts).not.toContain('DM-SHOP-CMD09');
    // CMD01 did exist at the baseline: removing it leaves its ghost, and no other box.
    await land(withoutCommand(withoutCommand(agentEdits(), 'DM-SHOP-CMD09'), 'DM-SHOP-CMD01'));
    await waitFor(() => expect(scene().ghosts).toContain('DM-SHOP-CMD01'));
    expect(drawnBox('DM-SHOP-CMD01')).toBeUndefined();
  });

  it('LA-EXP-UC15-R04-T01 The diff in the wiki card: each changed field old → new; an added record new since the baseline', async () => {
    await openAt('/DM-SHOP-CMD01');
    await land(agentEdits());
    const changes = await within(card()).findByRole('heading', { name: 'Changes' });
    const section = changes.closest('section')!;
    expect(section).toHaveTextContent('Changed since the last commit');
    expect(section.querySelector('del')).toHaveTextContent('Add item');
    expect(section.querySelector('ins')).toHaveTextContent('Put item in basket');
    await act(async () => { window.history.pushState(null, '', '/DM-SHOP-CMD09'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await within(card()).findByText(/New since the last commit/)).toBeInTheDocument();
  });

  it('LA-EXP-UC15-R04-T02 The wiki card lists the links a changed record gained and lost, beside each field old → new', async () => {
    await openAt('/DM-SHOP-CMD01');
    const edited = setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket', description: 'Puts an item in the trolley.' });
    const raises = edited.sources[0].tables.raises;
    raises.splice(raises.findIndex((r) => r.source_id === 'DM-SHOP-CMD01'), 1, { source_id: 'DM-SHOP-CMD01', target_id: 'DM-PAY-EV01' });
    await land(edited);
    const section = (await within(card()).findByRole('heading', { name: 'Changes' })).closest('section')!;
    // Each changed field, old → new.
    const pairs = [...section.querySelectorAll('.change-fields > div')].map((row) => [row.querySelector('dt')?.textContent, row.querySelector('del')?.textContent, row.querySelector('ins')?.textContent]);
    expect(pairs).toEqual([['title', 'Add item', 'Put item in basket'], ['description', 'Puts an item in the basket.', 'Puts an item in the trolley.']]);
    // Each link added and removed, listed.
    const links = within(section).getByRole('list', { name: 'Links added and removed' });
    expect(within(links).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Added raises .*Payment taken/), expect.stringMatching(/^Removed raises .*Item added/),
    ]);
  });

  it('LA-EXP-UC15-R05-T01 Follow glides to each change as it lands, and the Reader\'s own camera move or focus turns it off with a note', async () => {
    await openAt('/DM-SHOP-A1');
    fireEvent.click(within(tools()).getByRole('button', { name: 'Follow' }));
    expect(settings().follow).toBe(true);
    await land(setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(settings().follow).toBe(true);
    // A wheel on the stage is the Reader's camera move.
    fireEvent.wheel(screen.getByRole('region', { name: 'Graph stage' }).querySelector('canvas')!);
    await waitFor(() => expect(settings().follow).toBe(false));
    expect(within(tools()).getByRole('status')).toHaveTextContent('Follow is off: you moved the camera.');
    // On again, a focus the Reader moves turns it off too.
    fireEvent.click(within(tools()).getByRole('button', { name: 'Follow' }));
    await act(async () => { window.history.pushState(null, '', '/DM-SHOP-A1'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(settings().follow).toBe(false));
    expect(within(tools()).getByRole('status')).toHaveTextContent('Follow is off: you moved the focus.');
  });

  it('LA-EXP-UC15-R06-T01 The Changes panel lists the changes newest first, by record, as cards; a click focuses one; its toggle counts them', async () => {
    await openAt('/DM-SHOP-A1');
    await land(setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }));
    await new Promise((r) => setTimeout(r, 5));
    await land(setRow(setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }), 'aggregate', 'DM-SHOP-A1', { title: 'Cart' }));
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    fireEvent.click(count());
    const cards = await within(panel()).findAllByRole('listitem');
    const names = cards.filter((c) => c.classList.contains('card')).map((c) => c.querySelector('.card-title')?.textContent);
    expect(names[0]).toContain('DM-SHOP-A1');
    expect(names[1]).toContain('DM-SHOP-CMD01');
    fireEvent.click(within(panel()).getByRole('link', { name: /DM-SHOP-CMD01/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(new URLSearchParams(window.location.search).get('panel')).toBe('changes');
  });
});

describe('the stages and the card show the changes', () => {
  it('LA-V102-R06-T01 A changed record\'s wiki card shows its changes; the summary says it in a line', async () => {
    window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: false } }));
    await openAt('/DM-SHOP-CMD01');
    await land(agentEdits());
    expect(await within(card()).findByText(/Changed since the last commit/)).toHaveTextContent('title');
    fireEvent.click(within(card()).getByRole('button', { name: 'More' }));
    expect(await within(card()).findByRole('heading', { name: 'Changes' })).toBeInTheDocument();
  });

  it('LA-V96-R28-T01 Every stage shows the same Changes controls in the same place', async () => {
    const shown: string[][] = [];
    for (const stage of ['graph', 'erd', 'trace']) {
      await openAt(`/DM-SHOP-A1?stage=${stage}`);
      const group = tools();
      // In the shared stage toolbar, right after Frame.
      expect(group.closest('.stage-toolbar')).not.toBeNull();
      expect(group.previousElementSibling?.matches('.stage-frame') ?? group.previousElementSibling?.querySelector('.stage-frame')).toBeTruthy();
      shown.push([...group.querySelectorAll('button, select')].map((el) => el.className.split(' ').find((c) => c.startsWith('changes-')) ?? el.tagName));
    }
    expect(shown[1]).toEqual(shown[0]);
    expect(shown[2]).toEqual(shown[0]);
    expect(within(tools()).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, '').trim())).toEqual(['Highlight changes', 'Follow', 'Changes']);
  });

  it('LA-V96-R29-T01 Every stage marks the live changes: the ERD\'s boxes too, and only dots under reduced motion', async () => {
    await openAt('/DM-SHOP-A1?stage=erd');
    await waitFor(() => expect(erdDrawn()).toBe(true));
    await land(setRow(workspace(), 'aggregate', 'DM-SHOP-A1', { title: 'Cart' }));
    // Its pulse as it lands, and its lasting dot (erd/paint.ts).
    await waitFor(() => expect(erdBox('DM-SHOP-A1')).toMatchObject({ change: 'changed', flash: true, title: ['Cart'] }));

    // Under reduced motion: the dot, no pulse.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    window.matchMedia = globalThis.matchMedia;
    await land(setRow(workspace(), 'aggregate', 'DM-SHOP-A1', { title: 'Trolley' }));
    await waitFor(() => expect(erdBox('DM-SHOP-A1')?.title).toEqual(['Trolley']));
    expect(erdBox('DM-SHOP-A1')).toMatchObject({ change: 'changed', flash: false });
  });
});

describe('LA-V100 the Changes panel', () => {
  it('LA-V100-R01-T01 It lists the changes newest first, by record, as cards; a click focuses the record, the panel staying open', async () => {
    await openAt('/DM-SHOP-A1?panel=changes');
    expect(await within(panel()).findByText('Nothing has changed since the last commit.')).toBeInTheDocument();
    await land(agentEdits());
    const list = await within(panel()).findByRole('list', { name: 'Changed records' });
    expect(within(list).getAllByRole('link').filter((l) => l.classList.contains('card-title')).map((l) => l.textContent)).toEqual([
      expect.stringContaining('DM-SHOP-CMD01'), expect.stringContaining('DM-SHOP-CMD09'),
    ]);
    expect(within(list).getByText(/Changed: title/)).toHaveTextContent('just now');
    fireEvent.click(within(list).getByRole('link', { name: /DM-SHOP-CMD09/ }));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD09'));
    expect(panel()).toBeInTheDocument();
  });

  it('LA-V100-R02-T01 Its toggle shows how many records changed', async () => {
    await openAt('/DM-SHOP-A1');
    expect(count()).toHaveTextContent('0');
    await land(agentEdits());
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    expect(within(count()).getByLabelText('2 records changed')).toBeInTheDocument();
    fireEvent.click(count());
    expect(count()).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).toHaveTextContent('1 new · 1 changed');
  });
});
