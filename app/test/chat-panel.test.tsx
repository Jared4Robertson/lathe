import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY } from '../src/exploring/session-settings/repository';
import { focusAnswer, openAnswer } from '../src/chat/appRequests';
import { reloadChanges } from '../src/changes/changes';
import { sessionDate } from '../src/chat/ChatPanel';
import type { ChatBridge, ChatItem, ChatPatch, ChatSessions, ChatStatus, OpenChoice } from '../src/chat/types';
import { indexOf, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { desktopBridgeStub, openApp, serve } from './helpers';

// The desktop app's chat panel (LA-PLT-UC19, LA-V99) with a stand-in for the shell's chat
// (window.latheDesktop.chat): the test pushes the patches the shell would send.

const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock('../src/events', () => ({
  onLatheEvent: (event: string, callback: () => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    return () => listeners.get(event)!.delete(callback);
  },
}));

const host = window as unknown as { latheDesktop?: LatheDesktop };
const NOW = Date.now();
const SESSIONS: ChatSessions = {
  claude: '/Users/person/.local/bin/claude',
  configured: false,
  current: null,
  sessions: [
    { id: 's-new', title: 'Model the basket', updated: NOW - 5 * 60_000, openElsewhere: null },
    { id: 's-busy', title: 'Payments review', updated: NOW - 2 * 3_600_000, openElsewhere: 'running' },
  ],
};

function fakeChat(sessions: ChatSessions = SESSIONS) {
  let listener: ((patch: ChatPatch) => void) | null = null;
  const opened: OpenChoice[] = [];
  const sent: string[] = [];
  const answers: [string, boolean][] = [];
  let stops = 0;
  const bridge: ChatBridge = {
    sessions: async () => sessions,
    open: async (choice) => { opened.push(choice); return true; },
    send: async (text) => { sent.push(text); return true; },
    answer: async (id, allow) => { answers.push([id, allow]); return true; },
    stop: async () => { stops++; return true; },
    onPatch: (l) => { listener = l; return () => { listener = null; }; },
  };
  host.latheDesktop = desktopBridgeStub({ chat: bridge });
  // The first patch is the whole chat; later ones carry every item, as changed in place.
  let first = true;
  const push = (items: ChatItem[], status: ChatStatus = 'idle', sessionId = 's-new') => {
    const reset = first;
    first = false;
    act(() => listener?.({ reset, sessionId, status, items: items.map((item, at) => ({ at, item })) }));
  };
  return { opened, sent, answers, stops: () => stops, push };
}

const openChat = (open = true) =>
  window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout: 'tree', minimap: false, cardWidth: null, chat: open, chatWidth: null, lens: false, since: 'commit', follow: false, looked: {} }));
const chat = () => screen.getByRole('complementary', { name: 'Chat with Claude' });
const log = () => within(chat()).getByRole('log', { name: 'Conversation' });

beforeEach(() => openChat());
afterEach(() => {
  delete host.latheDesktop;
  document.documentElement.removeAttribute('data-title-bar');
});

describe('LA-V99-R01-T01 The chat floats at the right, measured by the stage, and its toggle and key show and hide it', () => {
  it('floats over the stage as a panel the stage measures, shown and hidden by its toggle and key', async () => {
    fakeChat();
    await openApp('/DM-SHOP-UC01');
    expect(chat()).toHaveAttribute('data-floating', 'right');
    expect(document.querySelector('.app')).toHaveClass('with-chat');
    fireEvent.click(screen.getByRole('button', { name: 'Hide the chat' }));
    expect(screen.queryByRole('complementary', { name: 'Chat with Claude' })).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ chat: false });
    // Its key (Ctrl+Cmd+I on a Mac, Ctrl+Alt+C here) shows it again with the message box focused.
    fireEvent.keyDown(document.body, { key: 'c', code: 'KeyC', ctrlKey: true, altKey: true });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message Claude' })).toHaveFocus());
    const toggle = screen.getByRole('button', { name: 'Show or hide the chat with Claude' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

});

describe('LA-PLT-UC19-R01-T04 The chat is offered in the desktop app on a wide window, and nowhere else', () => {
  it('is not drawn in a browser', async () => {
    await openApp('/DM-SHOP-UC01');
    expect(screen.queryByRole('complementary', { name: 'Chat with Claude' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show or hide the chat with Claude' })).toBeNull();
  });

  it('is not drawn on a phone', async () => {
    fakeChat();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await openApp('/DM-SHOP-UC01');
      expect(screen.queryByRole('complementary', { name: 'Chat with Claude' })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('LA-PLT-UC19-R02-T01 Record IDs in Claude\'s answers open the record on the stage', () => {
  it('draws Markdown, with each record it names a link to its page', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([
      { kind: 'user', id: 'u1', text: 'What adds an item?' },
      { kind: 'assistant', id: 'a1', text: 'The command **DM-SHOP-CMD01** adds it; NOPE-1 is no record.', streaming: false },
    ]);
    expect(within(log()).getByText('What adds an item?')).toBeInTheDocument();
    expect(within(log()).getByText(/adds it/).closest('strong, p')).not.toBeNull();
    const link = within(log()).getByRole('link', { name: 'DM-SHOP-CMD01' });
    expect(link).toHaveAttribute('title', 'Add item');
    expect(within(log()).queryByRole('link', { name: 'NOPE-1' })).toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Add item' })).toBeInTheDocument();
  });
});

describe('LA-PLT-UC19-R03-T01 Tool calls are rows that expand, and a turn\'s changed records show as diffs', () => {
  it('expands a tool row to its input and result', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'tool', id: 't1', name: 'mcp__plugin_lathe_lathe__show', label: 'lathe show', summary: 'DM-SHOP-CMD01', input: '{\n  "id": "DM-SHOP-CMD01"\n}', result: 'Command DM-SHOP-CMD01: Add item', status: 'done' }]);
    const row = within(log()).getByRole('button', { name: /lathe show/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(within(log()).queryByText('Command DM-SHOP-CMD01: Add item')).toBeNull();
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(within(log()).getByText('Command DM-SHOP-CMD01: Add item')).toBeInTheDocument();
    expect(within(log()).getByRole('img', { name: 'done' })).toBeInTheDocument();
  });

  it('shows the records a turn changed, field by field', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    const user: ChatItem = { kind: 'user', id: 'u1', text: 'Rename the command' };
    push([user], 'running');
    // Claude renames the command through Lathe's tools; the server reports the change.
    serve({ data: setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }) });
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });
    push([user, { kind: 'assistant', id: 'a1', text: 'Renamed.', streaming: false }], 'idle');
    const changes = await within(log()).findByText('1 record changed');
    const block = changes.closest('details')!;
    expect(within(block).getByText('Changed')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'DM-SHOP-CMD01' })).toBeInTheDocument();
    expect(block.querySelector('del')).toHaveTextContent('Add item');
    expect(block.querySelector('ins')).toHaveTextContent('Put item in basket');
  });
});

describe('LA-PLT-UC19-R03-T01 Tool calls are rows that expand, and a turn\'s changed records show as diffs', () => {
  it('finds records added, removed and changed, with their fields', () => {
    const before = workspace();
    const after = workspace();
    const commands = after.sources[0].tables.command;
    const removed = commands.splice(commands.findIndex((r) => r.id === 'DM-SHOP-CMD01'), 1)[0];
    commands.push({ ...removed, id: 'DM-SHOP-CMD09', title: 'Empty basket' });
    const views = after.sources[0].tables.view;
    views[0] = { ...views[0], description: 'Changed.' };
    const diffs = reloadChanges(indexOf(before), indexOf(after));
    expect(diffs.map((d) => [d.id, d.change])).toEqual(expect.arrayContaining([['DM-SHOP-CMD01', 'removed'], ['DM-SHOP-CMD09', 'added'], [views[0].id, 'changed']]));
    const was = before.sources[0].tables.view[0].description;
    expect(diffs.find((d) => d.id === views[0].id)!.fields).toEqual([{ name: 'description', ...(was === undefined ? {} : { before: was }), after: 'Changed.' }]);
    const same = indexOf(before);
    expect(reloadChanges(same, same)).toEqual([]);
  });
});

describe('LA-PLT-UC19-R04-T02 The Owner answers a permission prompt in the chat and stops a turn', () => {
  const prompt = (answer: 'pending' | 'allowed'): ChatItem => ({ kind: 'permission', id: 'p1', tool: 'Bash', label: 'Bash', summary: 'touch notes.txt', input: '{}', reason: 'Changes files.', answer });

  it('allows once or denies', async () => {
    const { push, answers } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([prompt('pending')], 'running');
    const ask = within(log()).getByRole('article', { name: 'Permission: Bash' });
    expect(ask).toHaveTextContent('Claude wants to use Bash: touch notes.txt');
    fireEvent.click(within(ask).getByRole('button', { name: 'Allow once' }));
    await waitFor(() => expect(answers).toEqual([['p1', true]]));
    fireEvent.click(within(ask).getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(answers).toEqual([['p1', true], ['p1', false]]));
    push([prompt('allowed')], 'running');
    expect(within(log()).getByText('Allowed once')).toBeInTheDocument();
    expect(within(log()).queryByRole('button', { name: 'Allow once' })).toBeNull();
  });

  it('sends with Enter, and stops with the Stop button or Escape', async () => {
    const { push, sent, stops } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([], 'idle');
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: 'Hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['Hello']));
    push([{ kind: 'user', id: 'u1', text: 'Hello' }], 'running');
    expect(within(chat()).getByText('Claude is working…')).toBeInTheDocument();
    fireEvent.click(within(chat()).getByRole('button', { name: 'Stop' }));
    fireEvent.keyDown(box, { key: 'Escape' });
    await waitFor(() => expect(stops()).toBe(2));
  });

  it('walks the messages with the arrow keys', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'user', id: 'u1', text: 'One' }, { kind: 'assistant', id: 'a1', text: 'Two', streaming: false }, { kind: 'notice', id: 'n1', text: 'Three', tone: 'info' }]);
    const items = within(log()).getAllByRole('article');
    expect(items.map((i) => i.tabIndex)).toEqual([-1, -1, 0]);
    items[2].focus();
    fireEvent.keyDown(items[2], { key: 'ArrowUp' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'Home' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'End' });
    expect(items[2]).toHaveFocus();
  });
});

describe('LA-PLT-UC19-R05-T02 The picker resumes, forks or starts a session, and warns of one open elsewhere', () => {
  it('lists the sessions by title and date until one is open', async () => {
    const { opened } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    const picker = await within(chat()).findByRole('region', { name: 'Sessions in this folder' });
    expect(within(picker).getByText('Model the basket')).toBeInTheDocument();
    expect(within(picker).getByText('5 minutes ago')).toBeInTheDocument();
    expect(within(picker).getByText('Open elsewhere')).toBeInTheDocument();
    fireEvent.click(within(picker).getByText('Model the basket'));
    await waitFor(() => expect(opened).toEqual([{ mode: 'resume', id: 's-new' }]));
    fireEvent.click(within(picker).getByRole('button', { name: 'Fork Model the basket' }));
    await waitFor(() => expect(opened.at(-1)).toEqual({ mode: 'fork', id: 's-new' }));
    fireEvent.click(within(picker).getByRole('button', { name: 'New session' }));
    await waitFor(() => expect(opened.at(-1)).toEqual({ mode: 'new' }));
  });

  it('offers a fork when the session may be open in another client', async () => {
    const { opened } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    const picker = await within(chat()).findByRole('region', { name: 'Sessions in this folder' });
    fireEvent.click(within(picker).getByText('Payments review'));
    const warning = within(picker).getByRole('alert');
    expect(warning).toHaveTextContent('is open in another Claude client now');
    expect(opened).toEqual([]);
    fireEvent.click(within(warning).getByRole('button', { name: 'Fork instead' }));
    await waitFor(() => expect(opened).toEqual([{ mode: 'fork', id: 's-busy' }]));
  });

  it('says how to set it up when Claude Code is not found', async () => {
    fakeChat({ claude: null, configured: false, current: null, sessions: [] });
    await openApp('/DM-SHOP-UC01');
    expect(await within(chat()).findByText(/Lathe could not find Claude Code/)).toBeInTheDocument();
    expect(within(chat()).getByRole('button', { name: 'New session' })).toBeDisabled();
  });

  it('dates a session as minutes, hours, days or its date', () => {
    expect(sessionDate(NOW - 30_000, NOW)).toBe('this minute');
    expect(sessionDate(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(sessionDate(NOW - 86_400_000, NOW)).toBe('yesterday');
    expect(sessionDate(Date.UTC(2020, 0, 15, 12), NOW)).toBe('Jan 15, 2020');
  });
});

describe('LA-PLT-UC19-R06-T03 The page answers the app bridge: what the Reader is looking at, and opening a record', () => {
  it('names the focused record and stage, and opens a record by its address', async () => {
    fakeChat();
    await openApp('/DM-SHOP-UC01?stage=erd');
    const index = indexOf(workspace());
    expect(focusAnswer(index, '/DM-SHOP-UC01', 'DM').page).toMatchObject({ focus: { id: 'DM-SHOP-UC01', kind: 'use_case', title: 'Add an item to the basket' }, stage: 'erd', product: 'DM', selected: null });
    let answer: { ok: boolean; message: string } | undefined;
    act(() => { answer = openAnswer(index, { id: 'DM-SHOP-CMD01', stage: 'graph' }); });
    expect(answer).toEqual({ ok: true, message: 'Opened DM-SHOP-CMD01 (command): Add item, on the Graph stage.' });
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(openAnswer(index, { id: 'DM-NOPE', stage: null })).toEqual({ ok: false, message: "There is no record DM-NOPE in this window's specs." });
  });
});
