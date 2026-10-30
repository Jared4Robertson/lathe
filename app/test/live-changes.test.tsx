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

// Watching the spec change (LA-EXP-UC15): the data reloads as the server reports a change (an Agent through the CLI
// or MCP, a git pull, the Reader), the stages mark what changed, and the Changes lens, the Changes panel and the wiki
// card compare the data with a baseline the server reads from git (stood in for here by `baseline`).

const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock('../src/events', () => ({
  onLatheEvent: (event: string, callback: () => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    return () => listeners.get(event)!.delete(callback);
  },
}));

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

  it('LA-EXP-UC15-R03-T01 The Changes lens dims everything unchanged, against the last commit, where the branch left main, or the moment the Reader last looked', async () => {
    const asked: string[] = [];
    await openAt('/DM-SHOP-CMD01', asked);
    await land(agentEdits(), asked);
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    fireEvent.click(within(tools()).getByRole('button', { name: 'Changes lens' }));
    expect(within(tools()).getByRole('button', { name: 'Changes lens' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(drawnBox('DM-SHOP-CMD01')?.strength).toBe(1));
    const unchanged = scene().boxes.filter((b) => !['DM-SHOP-CMD01', 'DM-SHOP-CMD09'].includes(b.id));
    expect(unchanged.length).toBeGreaterThan(0);
    expect(unchanged.every((b) => b.strength < 1)).toBe(true);

    const picker = within(tools()).getByRole('combobox', { name: 'Compared with' });
    fireEvent.change(picker, { target: { value: 'branch' } });
    await waitFor(() => expect(asked).toContain('branch'));
    expect(settings().since).toBe('branch');
    // Since I last looked: the moment the Reader entered the product, a commit and what differed from it then.
    expect(settings().looked.DM).toMatchObject({ commit: HEAD });
    fireEvent.change(picker, { target: { value: 'looked' } });
    await waitFor(() => expect(asked).toContain(HEAD));
    await waitFor(() => expect(count()).toHaveTextContent('2'));
    // Dismissing the lens is looking: nothing has changed since.
    const before = settings().looked.DM.at;
    fireEvent.click(within(tools()).getByRole('button', { name: 'Changes lens' }));
    await waitFor(() => expect(settings().looked.DM.at).not.toBe(before));
    await waitFor(() => expect(count()).toHaveTextContent('0'));
    expect(settings().looked.DM.delta.command.rows.map((r: { id: string }) => r.id).sort()).toEqual(['DM-SHOP-CMD01', 'DM-SHOP-CMD09']);
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
  it('LA-V96-R27-T01 A changed record\'s wiki card shows its changes; the summary says it in a line', async () => {
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
    expect(within(tools()).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, '').trim())).toEqual(['Changes lens', 'Follow', 'Changes']);
  });

  it('LA-V96-R29-T01 Every stage marks the live changes: the ERD\'s boxes too, and only dots under reduced motion', async () => {
    await openAt('/DM-SHOP-A1?stage=erd');
    await waitFor(() => expect(document.querySelector('.erd-box')).not.toBeNull());
    await land(setRow(workspace(), 'aggregate', 'DM-SHOP-A1', { title: 'Cart' }));
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="DM-SHOP-A1"] .erd-box')).toHaveAttribute('data-change', 'changed'));
    const box = document.querySelector('.react-flow__node[data-id="DM-SHOP-A1"] .erd-box')!;
    expect(box.querySelector('.erd-change-dot')).not.toBeNull();
    expect(box.querySelector('.erd-change-flash')).not.toBeNull();

    // Under reduced motion: the dot, no pulse.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    window.matchMedia = globalThis.matchMedia;
    await land(setRow(workspace(), 'aggregate', 'DM-SHOP-A1', { title: 'Trolley' }));
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="DM-SHOP-A1"] .erd-box')?.querySelector('.erd-change-flash')).toBeNull());
    expect(document.querySelector('.react-flow__node[data-id="DM-SHOP-A1"] .erd-change-dot')).not.toBeNull();
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
    expect(panel()).toHaveTextContent('1 changed · 1 new');
  });
});
