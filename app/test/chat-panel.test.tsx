import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY } from '../src/exploring/session-settings/repository';
import { focusAnswer, focusContext, openAnswer } from '../src/chat/appRequests';
import { reloadChanges } from '../src/changes/changes';
import { sessionDate } from '../src/chat/ChatPanel';
import type { ChatBridge, ChatItem, ChatMode, ChatPatch, ChatSessions, ChatSkill, ChatStatus, LatheTools, OpenChoice, PromptAnswer, VoiceBridge, VoiceEvent, VoiceSupport } from '../src/chat/types';
import { chatDraft } from '../src/chat/draft';
import { chatChips } from '../src/chat/chips';
import { setRow } from './fixtures/load';
import { recordIndexOf } from './read-view';
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
  } }));

const host = window as unknown as { latheDesktop?: LatheDesktop };
const NOW = Date.now();
const SESSIONS: ChatSessions = {
  claude: '/Users/person/.local/bin/claude',
  configured: false,
  signedIn: true,
  mode: 'accept-reads',
  current: null,
  sessions: [
    { id: 's-new', title: 'Model the basket', updated: NOW - 5 * 60_000, openElsewhere: null },
    { id: 's-busy', title: 'Payments review', updated: NOW - 2 * 3_600_000, openElsewhere: 'running' },
  ] };

const SKILLS: ChatSkill[] = [
  { name: 'compact', description: 'Summarize the conversation so far to free context.', kind: 'command' },
  { name: 'lathe:check-and-fix', description: 'Run lathe check and fix every error it reports.', kind: 'skill' },
  { name: 'lathe:plan-tests', description: 'Write or change Lathe test records.', kind: 'skill' },
];

function fakeChat(sessions: ChatSessions = SESSIONS) {
  let listener: ((patch: ChatPatch) => void) | null = null;
  const opened: OpenChoice[] = [];
  const sent: string[] = [];
  const focuses: (string | null)[] = [];
  const answers: [string, PromptAnswer][] = [];
  const modes: ChatMode[] = [];
  const models: [string | null, string | null][] = [];
  const unqueued: string[] = [];
  const imageCounts: number[] = [];
  let stops = 0;
  const bridge: ChatBridge = {
    sessions: async () => sessions,
    open: async (choice) => { opened.push(choice); return true; },
    send: async (text, focus, images) => { sent.push(text); focuses.push(focus); imageCounts.push(images.length); return true; },
    setModel: async (model, effort) => { models.push([model, effort]); return true; },
    unqueue: async (id) => { unqueued.push(id); return true; },
    skills: async () => SKILLS,
    captureStage: async () => 'iVBORw0KGgo=',
    answer: async (id, reply) => { answers.push([id, reply]); return true; },
    stop: async () => { stops++; return true; },
    setMode: async (mode) => { modes.push(mode); return true; },
    onPatch: (l) => { listener = l; return () => { listener = null; }; } };
  host.latheDesktop = desktopBridgeStub({ chat: bridge });
  // The first patch is the whole chat; later ones carry every item, as changed in place.
  let first = true;
  const push = (items: ChatItem[], status: ChatStatus = 'idle', sessionId = 's-new', mode: ChatMode = 'accept-reads', lathe: LatheTools = { status: 'loaded', version: '2.0.0', count: 142 }, extra: { choice?: ChatPatch['choice']; queue?: ChatPatch['queue'] } = {}) => {
    const reset = first;
    first = false;
    act(() => listener?.({ reset, sessionId, status, mode, choice: extra.choice ?? { model: null, effort: null }, queue: extra.queue ?? [], lathe, items: items.map((item, at) => ({ at, item })) }));
  };
  return { opened, sent, focuses, answers, modes, models, unqueued, imageCounts, stops: () => stops, push };
}

const openChat = (open = true) =>
  window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout: 'tree', minimap: false, allLinks: false, cardWidth: null, chat: open, chatWidth: null, highlight: false, since: 'commit', follow: false, looked: {} }));
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
      { kind: 'user', images: 0, id: 'u1', text: 'What adds an item?' },
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

  it('shows the records a turn changed', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    const user: ChatItem = { kind: 'user', images: 0, id: 'u1', text: 'Rename the command' };
    push([user], 'running');
    // Claude renames the command through Lathe's tools; the server reports the change.
    serve({ data: setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }) });
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });
    push([user, { kind: 'assistant', id: 'a1', text: 'Renamed.', streaming: false }], 'idle');
    const changes = await within(log()).findByText('1 record changed');
    const block = changes.closest('details')!;
    expect(within(block).getByText('Changed')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'DM-SHOP-CMD01' })).toBeInTheDocument();
    expect(block).toHaveTextContent('Put item in basket');
  });
});

describe('LA-PLT-UC19-R03-T01 Tool calls are rows that expand, and a turn\'s changed records show as diffs', () => {
  it('finds records added, removed and changed, by their digests', () => {
    const before = workspace();
    const after = workspace();
    const commands = after.sources[0].tables.command;
    const removed = commands.splice(commands.findIndex((r) => r.id === 'DM-SHOP-CMD01'), 1)[0];
    commands.push({ ...removed, id: 'DM-SHOP-CMD09', title: 'Empty basket' });
    const views = after.sources[0].tables.view;
    views[0] = { ...views[0], description: 'Changed.' };
    const diffs = reloadChanges(recordIndexOf(before), recordIndexOf(after));
    expect(diffs.map((d) => [d.id, d.change])).toEqual(expect.arrayContaining([['DM-SHOP-CMD01', 'removed'], ['DM-SHOP-CMD09', 'added'], [views[0].id, 'changed']]));
    const same = recordIndexOf(before);
    expect(reloadChanges(same, same)).toEqual([]);
  });
});

describe('LA-PLT-UC19-R04-T02 The Owner answers a permission prompt in the chat and stops a turn', () => {
  const prompt = (answer: 'pending' | 'allowed'): ChatItem => ({ kind: 'permission', id: 'p1', tool: 'Bash', label: 'Bash', summary: 'touch notes.txt', input: '{}', reason: 'Changes files.', answer });

  it('allows once, always in this chat, or denies', async () => {
    const { push, answers } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([prompt('pending')], 'running');
    const ask = within(log()).getByRole('article', { name: 'Permission: Bash' });
    expect(ask).toHaveTextContent('Claude wants to use Bash: touch notes.txt');
    fireEvent.click(within(ask).getByRole('button', { name: 'Allow once' }));
    await waitFor(() => expect(answers).toEqual([['p1', 'once']]));
    fireEvent.click(within(ask).getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(answers).toEqual([['p1', 'once'], ['p1', 'deny']]));
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
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Hello' }], 'running');
    expect(within(chat()).getByText('Claude is working…')).toBeInTheDocument();
    fireEvent.click(within(chat()).getByRole('button', { name: 'Stop' }));
    fireEvent.keyDown(box, { key: 'Escape' });
    await waitFor(() => expect(stops()).toBe(2));
  });

  it('walks the messages with the arrow keys', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'user', images: 0, id: 'u1', text: 'One' }, { kind: 'assistant', id: 'a1', text: 'Two', streaming: false }, { kind: 'notice', id: 'n1', text: 'Three', tone: 'info' }]);
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
    fakeChat({ claude: null, configured: false, signedIn: null, mode: 'accept-reads', current: null, sessions: [] });
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
    const index = recordIndexOf(workspace());
    expect(focusAnswer(index, '/DM-SHOP-UC01', 'DM').page).toMatchObject({ focus: { id: 'DM-SHOP-UC01', kind: 'use_case', title: 'Add an item to the basket' }, stage: 'erd', product: 'DM', selected: null });
    let answer: { ok: boolean; message: string } | undefined;
    act(() => { answer = openAnswer(index, { id: 'DM-SHOP-CMD01', stage: 'graph' }); });
    expect(answer).toEqual({ ok: true, message: 'Opened DM-SHOP-CMD01 (command): Add item, on the Graph stage.' });
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-CMD01'));
    expect(openAnswer(index, { id: 'DM-NOPE', stage: null })).toEqual({ ok: false, message: "There is no record DM-NOPE in this window's specs." });
  });
});

describe('LA-V99-R03-T01 The chat\'s head shows the Lathe tools, the permission mode and Bypass; the empty chat says when Claude Code cannot answer', () => {
  it('shows how many Lathe tools the session has and from which Lathe, or that they are loading or did not load', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    // The head says "142 Lathe tools"; which Lathe they come from is in its tooltip.
    expect(within(chat()).getByText('142 Lathe tools')).toHaveAttribute('title', '142 tools from Lathe 2.0.0');
    push([], 'idle', 's-new', 'accept-reads', { status: 'counting', version: '2.0.0' });
    expect(within(chat()).getByText('Loading tools…')).toBeInTheDocument();
    push([], 'idle', 's-new', 'accept-reads', { status: 'failed', version: null, problem: 'No lathe.config.json.' });
    expect(within(chat()).getByText('Lathe tools failed')).toBeInTheDocument();
  });

  it('chooses a mode from the menu by keyboard, and shows the open chat\'s mode', async () => {
    const { push, modes } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const button = within(chat()).getByRole('button', { name: 'Permission mode: Accept reads' });
    fireEvent.click(button);
    const menu = within(chat()).getByRole('menu', { name: 'Permission mode' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/^Ask/), expect.stringMatching(/^Accept reads/), expect.stringMatching(/^Auto/), expect.stringMatching(/^Bypass/), expect.stringMatching(/^View only/),
    ]);
    expect(items[1]).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(items[1]).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'End' });
    await waitFor(() => expect(items[4]).toHaveFocus());
    fireEvent.click(items[4]);
    await waitFor(() => expect(modes).toEqual(['view-only']));
    push([], 'idle', 's-new', 'view-only');
    expect(within(chat()).getByRole('button', { name: 'Permission mode: View only' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message Claude' })).toHaveAttribute('placeholder', 'Ask Claude, View only…');
  });

  it('warns before Bypass, and shows its badge while it is on', async () => {
    const { push, modes } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    fireEvent.click(within(chat()).getByRole('button', { name: 'Permission mode: Accept reads' }));
    fireEvent.click(within(chat()).getByRole('menuitemradio', { name: /^Bypass/ }));
    const warning = within(chat()).getByRole('alertdialog', { name: 'Turn on Bypass?' });
    expect(warning).toHaveTextContent('Claude will use every tool without asking you');
    expect(modes).toEqual([]);
    fireEvent.click(within(warning).getByRole('button', { name: 'Cancel' }));
    expect(within(chat()).queryByRole('alertdialog')).toBeNull();
    fireEvent.click(within(chat()).getByRole('button', { name: 'Permission mode: Accept reads' }));
    fireEvent.click(within(chat()).getByRole('menuitemradio', { name: /^Bypass/ }));
    fireEvent.click(within(chat()).getByRole('button', { name: 'Turn on Bypass' }));
    await waitFor(() => expect(modes).toEqual(['bypass']));
    expect(within(chat()).queryByText('Bypass', { selector: '.chat-bypass-badge' })).toBeNull();
    push([], 'idle', 's-new', 'bypass');
    expect(within(chat()).getByText('Bypass', { selector: '.chat-bypass-badge' })).toBeInTheDocument();
  });

  it('says Claude Code is not signed in, with the fix, and starts no session', async () => {
    const { opened, sent } = fakeChat({ ...SESSIONS, signedIn: false });
    await openApp('/DM-SHOP-UC01');
    const alert = await within(chat()).findByText(/Claude Code is not signed in/);
    expect(alert).toHaveTextContent('run claude and type /login');
    expect(within(chat()).getByRole('button', { name: 'New session' })).toBeDisabled();
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: 'Hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    expect(opened).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('says where to install Claude Code when it is not found', async () => {
    fakeChat({ ...SESSIONS, claude: null, signedIn: null });
    await openApp('/DM-SHOP-UC01');
    await within(chat()).findByText(/Lathe could not find Claude Code/);
    expect(within(chat()).getByRole('link', { name: 'claude.com/claude-code' })).toHaveAttribute('href', 'https://claude.com/claude-code');
  });
});

describe('LA-PLT-UC19-R11-T03 A prompt offers Allow always in this chat', () => {
  it('sends always, and shows the answer', async () => {
    const { push, answers } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    const prompt = (answer: 'pending' | 'always'): ChatItem => ({ kind: 'permission', id: 'p1', tool: 'Bash', label: 'Bash', summary: 'git status', input: '{}', reason: null, answer });
    push([prompt('pending')], 'running');
    fireEvent.click(within(log()).getByRole('button', { name: 'Allow always in this chat' }));
    await waitFor(() => expect(answers).toEqual([['p1', 'always']]));
    push([prompt('always')], 'running');
    expect(within(log()).getByText('Allowed always in this chat')).toBeInTheDocument();
  });
});

describe('LA-PLT-UC19-R12-T04 The chat knows where the Owner is: a chip above the message box, sent as context', () => {
  it('names the focused record and stage, sends it with the message, and leaves it out once removed', async () => {
    const { push, sent, focuses } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const chip = await within(chat()).findByText('Viewing DM-SHOP-UC01 on the Graph');
    expect(chip).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: 'What does this need?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['What does this need?']));
    expect(focuses[0]).toContain('Focused record: DM-SHOP-UC01 (use_case): Add an item to the basket');
    expect(focuses[0]).toContain('Stage: Graph');
    fireEvent.click(within(chat()).getByRole('button', { name: 'Leave out: Viewing DM-SHOP-UC01 on the Graph' }));
    expect(within(chat()).queryByText('Viewing DM-SHOP-UC01 on the Graph')).toBeNull();
    fireEvent.change(box, { target: { value: 'And now?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['What does this need?', 'And now?']));
    expect(focuses[1]).toBeNull();
  });

  it('builds the chip and the context from what app_focus answers', () => {
    const index = recordIndexOf(workspace());
    expect(focusContext(index, '/', 'DM')).toEqual({ label: 'Viewing the products', context: 'Product: DM\nPage: /' });
  });
});

// ---------- Voice (LA-V99-R04) ----------

/** A stand-in for the shell's voice: the test says what it hears. */
function fakeVoice(support: Partial<VoiceSupport> = {}) {
  let listener: ((event: VoiceEvent) => void) | null = null;
  const listens: boolean[] = [];
  const voice: VoiceBridge = {
    support: async () => ({ available: true, reason: null, microphone: 'granted', endOfTurn: true, ...support }),
    listen: async (on) => { listens.push(on); return on ? 'listening' : 'stopped'; },
    onEvent: (l) => { listener = l; return () => { listener = null; }; } };
  const hear = (event: VoiceEvent) => act(() => listener?.(event));
  return { voice, listens, hear };
}

describe('LA-V99-R04-T01 The mic button dictates into the message box; the Voice menu turns on voice activation and Quick mode', () => {
  beforeEach(() => chatDraft.write(''));

  it('dictates the heard words into the message box, to edit and send', async () => {
    const chatFake = fakeChat();
    const { voice, listens, hear } = fakeVoice();
    host.latheDesktop = { ...host.latheDesktop!, voice };
    await openApp('/DM-SHOP-UC01');
    chatFake.push([]);
    const mic = await within(chat()).findByRole('button', { name: 'Dictate' });
    fireEvent.click(mic);
    await waitFor(() => expect(listens).toEqual([true]));
    expect(within(chat()).getByRole('button', { name: 'Stop dictating' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chat()).getByText(/Listening. Say “Lathe, send” to send/)).toBeInTheDocument();
    hear({ type: 'listening', on: true, why: 'started', message: null });
    hear({ type: 'speech', at: 0.1 });
    hear({ type: 'volatile', text: 'What does' });
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    expect(box).toHaveValue('What does');
    hear({ type: 'final', words: [{ text: 'What', start: 0.1, end: 0.3 }, { text: 'does', start: 0.3, end: 0.5 }, { text: 'this', start: 0.5, end: 0.7 }, { text: 'need?', start: 0.7, end: 1 }] });
    expect(box).toHaveValue('What does this need?');
    fireEvent.click(within(chat()).getByRole('button', { name: 'Stop dictating' }));
    await waitFor(() => expect(listens).toEqual([true, false]));
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(chatFake.sent).toEqual(['What does this need?']));
  });

  it('turns on voice activation and Quick mode from the Voice menu, kept from one launch to the next, and refuses clashing phrases', async () => {
    fakeChat();
    const { voice, listens } = fakeVoice();
    host.latheDesktop = { ...host.latheDesktop!, voice };
    await openApp('/DM-SHOP-UC01');
    fireEvent.click(await within(chat()).findByRole('button', { name: 'Voice' }));
    const menu = within(chat()).getByRole('group', { name: 'Voice' });
    fireEvent.click(within(menu).getByRole('switch', { name: /Voice activation/ }));
    await waitFor(() => expect(listens).toEqual([true]));
    expect(within(chat()).getByText('Listening for “Lathe”')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('switch', { name: /Quick mode/ }));
    expect(JSON.parse(window.localStorage.getItem('lathe:voice')!)).toMatchObject({ activation: true, quick: true, wake: 'Lathe' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Use “Hey Lathe”' }));
    fireEvent.change(within(menu).getByRole('textbox', { name: 'Send' }), { target: { value: 'hey lathe' } });
    fireEvent.click(within(menu).getByRole('button', { name: 'Save phrases' }));
    expect(within(menu).getByRole('alert')).toHaveTextContent('The command "Send" is the wake phrase.');
    fireEvent.change(within(menu).getByRole('textbox', { name: 'Send' }), { target: { value: 'ship it' } });
    fireEvent.click(within(menu).getByRole('button', { name: 'Save phrases' }));
    expect(JSON.parse(window.localStorage.getItem('lathe:voice')!)).toMatchObject({ wake: 'Hey Lathe', commands: { send: 'ship it' } });
    expect(within(chat()).getByText('Listening for “Hey Lathe”')).toBeInTheDocument();
  });

  it('says what listening means before macOS first asks for the microphone', async () => {
    fakeChat();
    const { voice, listens } = fakeVoice({ microphone: 'not-determined' });
    host.latheDesktop = { ...host.latheDesktop!, voice };
    await openApp('/DM-SHOP-UC01');
    fireEvent.click(await within(chat()).findByRole('button', { name: 'Dictate' }));
    const intro = within(chat()).getByRole('alertdialog', { name: 'Talk to Claude?' });
    expect(intro).toHaveTextContent('the audio never leaves this Mac, and nothing is recorded or saved');
    expect(listens).toEqual([]);
    fireEvent.click(within(intro).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(listens).toEqual([true]));
  });

  it('shows Quick mode\'s countdown on Send, and hides the mic where the Mac cannot recognize speech on-device', async () => {
    fakeChat();
    const { voice, hear } = fakeVoice();
    host.latheDesktop = { ...host.latheDesktop!, voice };
    window.localStorage.setItem('lathe:voice', JSON.stringify({ activation: false, quick: true, wake: 'Lathe', commands: { send: 'send', cancel: 'cancel', scratch: 'scratch that', newLine: 'new line' } }));
    await openApp('/DM-SHOP-UC01');
    fireEvent.click(await within(chat()).findByRole('button', { name: 'Dictate' }));
    hear({ type: 'listening', on: true, why: 'started', message: null });
    hear({ type: 'speech', at: 0.1 });
    hear({ type: 'final', words: [{ text: 'Zoom', start: 0.1, end: 0.3 }, { text: 'into', start: 0.3, end: 0.5 }, { text: 'the', start: 0.5, end: 0.7 }] });
    hear({ type: 'silence', at: 0.8, pitch: 'level' });
    expect(within(chat()).getByRole('button', { name: /Send now/ })).toHaveClass('is-counting');
    expect(within(chat()).getByText(/Sending in 3\.\d s. Any key or sound cancels./)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message Claude' }), { key: 'Shift' });
    expect(within(chat()).getByRole('button', { name: 'Send' })).not.toHaveClass('is-counting');
  });

  it('has no mic where on-device dictation is not available', async () => {
    fakeChat();
    await openApp('/DM-SHOP-UC01');
    await within(chat()).findByRole('textbox', { name: 'Message Claude' });
    expect(within(chat()).queryByRole('button', { name: 'Dictate' })).toBeNull();
    expect(within(chat()).queryByRole('button', { name: 'Voice' })).toBeNull();
  });
});

// ---------- Point and ask, review and undo, "/", the model, the queue and images (LA-PLT-UC22-R01..R18) ----------

/** Answers the turn routes (snapshot, a turn's changes, undo) in front of the served fetch; the test says what undo answers. */
function stubTurnRoutes(undo: { status: number; body: unknown } = { status: 200, body: { ok: true, tables: [], files: [], changes: [] } }) {
  const inner = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/snapshot') { calls.push({ url, body: JSON.parse(String(init?.body)) }); return json({ snapshot: 'snap-1' }); }
    if (url === '/api/turn-changes') {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return json([{ id: 'DM-SHOP-CMD01', kind: 'command', title: 'Put item in basket', change: 'changed', fields: [{ name: 'title', before: 'Add item', after: 'Put item in basket' }], parts: [], links: { added: [], removed: [] } }]);
    }
    if (url === '/api/undo') { calls.push({ url, body: JSON.parse(String(init?.body)) }); return json(undo.body, undo.status); }
    return inner(input, init);
  }));
  return calls;
}

/** A turn in which Claude renames a command: the user's message, the tool call, and the answer. */
async function renameTurn(push: ReturnType<typeof fakeChat>['push']) {
  const user: ChatItem = { kind: 'user', images: 0, id: 'u1', text: 'Rename the command' };
  // The server is told as the turn begins (it keeps the rows then), and reports the change once Claude has written.
  serve({ data: setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }) });
  stubTurnRoutes();
  push([user], 'running');
  const tool: ChatItem = { kind: 'tool', id: 't1', name: 'mcp__plugin_lathe_lathe__command_change_command', label: 'lathe command_change_command', summary: 'DM-SHOP-CMD01', input: '{"id":"DM-SHOP-CMD01","title":"Put item in basket"}', result: 'Changed', status: 'done' };
  await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });
  const done = [user, tool, { kind: 'assistant', id: 'a1', text: 'Renamed.', streaming: false } as ChatItem];
  push(done, 'idle');
  return done;
}

describe('LA-PLT-UC22-R01-T01 Ask Claude about this attaches the pointed-at record as a chip, sent as context', () => {
  beforeEach(() => { chatDraft.write(''); chatChips.clear(); });

  it('attaches the focused record by its key, shows it as a chip with its title, and sends it with the message', async () => {
    const { push, sent, focuses } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true, altKey: true });
    const chips = await within(chat()).findByRole('list', { name: 'Records attached to your message' });
    expect(chips).toHaveTextContent('DM-SHOP-UC01 Add an item to the basket');
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: 'Is this complete?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['Is this complete?']));
    expect(focuses[0]).toContain('The Owner pointed at these records');
    expect(focuses[0]).toContain('DM-SHOP-UC01 (use_case): Add an item to the basket');
    // The chips go once the message has.
    await waitFor(() => expect(within(chat()).queryByRole('list', { name: 'Records attached to your message' })).toBeNull());
  });

  it('takes a chip out before the message goes', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    act(() => { chatChips.add('DM-SHOP-CMD01'); chatChips.add('DM-SHOP-UC01'); });
    expect(within(chat()).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(within(chat()).getByRole('button', { name: /Leave out: DM-SHOP-CMD01/ }));
    expect(chatChips.read()).toEqual(['DM-SHOP-UC01']);
  });
});

describe('LA-PLT-UC21-R01-T01 After a turn that writes, its records can be put under review: lit on the stage and walked through with their diffs', () => {
  it('starts the review from the turn\'s changes, shows the diff, and ends it with Done', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    await renameTurn(push);
    await within(log()).findByText('1 record changed');
    fireEvent.click(within(log()).getByRole('button', { name: "Review Claude's changes" }));
    const bar = await screen.findByRole('region', { name: "Review Claude's changes" });
    expect(within(bar).getByText("Claude's changes, turn 1")).toBeInTheDocument();
    await waitFor(() => expect(within(bar).getByText('1 of 1')).toBeInTheDocument());
    expect(bar).toHaveTextContent('Put item in basket');
    expect(bar).toHaveTextContent('Add item');
    // Highlight changes lights the review alone, whatever the setting says.
    expect(document.querySelector('.changes-highlight')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(bar).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: "Review Claude's changes" })).toBeNull();
  });
});

describe('LA-PLT-UC21-R02-T01 A turn is undone in one click through the server, which refuses with its reasons what something since depends on', () => {
  it('asks the server to roll back to the turn\'s snapshot, naming the records Claude touched in order, and says it is undone', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const done = await renameTurn(push);
    await within(log()).findByText('1 record changed');
    await waitFor(() => expect(within(log()).getByRole('button', { name: 'Undo this turn' })).toBeEnabled());
    const calls = (globalThis.fetch as unknown as { mock: { calls: [RequestInfo, RequestInit?][] } }).mock.calls;
    fireEvent.click(within(log()).getByRole('button', { name: 'Undo this turn' }));
    await within(log()).findByText('Undone');
    const undo = calls.find(([url]) => url === '/api/undo');
    expect(JSON.parse(String(undo?.[1]?.body))).toEqual({ snapshot: 'snap-1', order: ['DM-SHOP-CMD01'] });
    expect(done).toHaveLength(3);
  });

  it('shows the server\'s reasons when it refuses, and leaves the turn undoable', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const user: ChatItem = { kind: 'user', images: 0, id: 'u1', text: 'Rename the command' };
    serve({ data: setRow(workspace(), 'command', 'DM-SHOP-CMD01', { title: 'Put item in basket' }) });
    stubTurnRoutes({ status: 422, body: { ok: false, error: 'x', problems: [{ rule: 'referenced', message: 'DM-SHOP-CMD01 is referenced, so it stays: DM-SHOP-UC01-F01-S02 invokes it' }] } });
    push([user], 'running');
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });
    push([user, { kind: 'assistant', id: 'a1', text: 'Renamed.', streaming: false }], 'idle');
    await within(log()).findByText('1 record changed');
    await waitFor(() => expect(within(log()).getByRole('button', { name: 'Undo this turn' })).toBeEnabled());
    fireEvent.click(within(log()).getByRole('button', { name: 'Undo this turn' }));
    const alert = await within(log()).findByRole('alert');
    expect(alert).toHaveTextContent('Not undone; nothing changed');
    expect(alert).toHaveTextContent('DM-SHOP-CMD01 is referenced, so it stays');
    expect(within(log()).getByRole('button', { name: 'Undo this turn' })).toBeEnabled();
  });
});

describe('LA-PLT-UC21-R03-T01 A record ID in Claude\'s reply focuses the stage, and Cmd or Ctrl+click opens it in a new tab', () => {
  it('opens a mentioned record in a new place on a Cmd+click, and focuses it on a plain click', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'assistant', id: 'a1', text: 'See DM-SHOP-CMD01 for that.', streaming: false }]);
    const link = within(log()).getByRole('link', { name: 'DM-SHOP-CMD01' });
    expect(link).toHaveAttribute('href', expect.stringContaining('DM-SHOP-CMD01'));
    fireEvent.click(link, { metaKey: true });
    // The stage did not move: the record opened in a new place (a new browser tab here).
    expect(window.location.pathname).toContain('DM-SHOP-UC01');
    fireEvent.click(link);
    await waitFor(() => expect(window.location.pathname).toContain('DM-SHOP-CMD01'));
  });
});

describe('LA-PLT-UC22-R02-T01 Typing / lists the skills and slash commands with one-line descriptions', () => {
  beforeEach(() => chatDraft.write(''));

  it('lists them, narrows as the name is typed, and picks one by keyboard', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: '/' } });
    const list = await screen.findByRole('listbox', { name: 'Skills and slash commands' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '/compactSummarize the conversation so far to free context.',
      '/lathe:check-and-fixRun lathe check and fix every error it reports.',
      '/lathe:plan-testsWrite or change Lathe test records.',
    ]);
    fireEvent.change(box, { target: { value: '/plan' } });
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(box).toHaveValue('/lathe:plan-tests ');
    expect(screen.queryByRole('listbox', { name: 'Skills and slash commands' })).toBeNull();
  });

  it('closes on Escape and lists nothing for a message that is not a slash and a name', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: '/c' } });
    await screen.findByRole('listbox', { name: 'Skills and slash commands' });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Skills and slash commands' })).toBeNull();
    fireEvent.change(box, { target: { value: 'what is /compact' } });
    expect(screen.queryByRole('listbox', { name: 'Skills and slash commands' })).toBeNull();
  });
});

describe('LA-PLT-UC22-R03-T03 The header\'s picker chooses the model and effort', () => {
  it('names the choice, opens a menu of models and efforts, and sends the choice; it is not offered while Claude works', async () => {
    const { push, models } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([], 'idle', 's-new', 'accept-reads', undefined, { choice: { model: 'sonnet', effort: 'high' } });
    const button = await within(chat()).findByRole('button', { name: 'Model and effort: Sonnet · High' });
    fireEvent.click(button);
    const menu = within(chat()).getByRole('menu', { name: 'Model and effort' });
    expect(within(menu).getAllByRole('menuitemradio').map((i) => i.getAttribute('aria-checked'))).toContain('true');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Opus/ }));
    await waitFor(() => expect(models).toEqual([['opus', 'high']]));
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Go' }], 'running', 's-new', 'accept-reads', undefined, { choice: { model: 'opus', effort: 'high' } });
    expect(within(chat()).getByRole('button', { name: 'Model and effort: Opus · High' })).toBeDisabled();
  });
});

describe('LA-PLT-UC22-R04-T02 A message typed while Claude works is queued, listed and sent in order; Stop is there while it works', () => {
  beforeEach(() => chatDraft.write(''));

  it('sends with Enter while it works, lists what waits, and takes a message back out', async () => {
    const { push, sent, unqueued } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Go' }], 'running');
    expect(within(chat()).getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.change(box, { target: { value: 'Then this' } });
    expect(within(chat()).getByRole('button', { name: 'Queue message' })).toBeEnabled();
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['Then this']));
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Go' }], 'running', 's-new', 'accept-reads', undefined, { queue: [{ id: 'q:1', text: 'Then this', images: 0 }] });
    const queue = within(chat()).getByRole('region', { name: 'Messages waiting for Claude' });
    expect(queue).toHaveTextContent('Then this');
    fireEvent.click(within(queue).getByRole('button', { name: /Remove from the queue: Then this/ }));
    await waitFor(() => expect(unqueued).toEqual(['q:1']));
  });
});

describe('LA-PLT-UC22-R05-T01 Images are pasted into a message, or the stage is sent as one', () => {
  beforeEach(() => chatDraft.write(''));

  it('attaches a pasted image and the stage, and sends them with the message', async () => {
    const { push, sent, imageCounts } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' });
    fireEvent.paste(box, { clipboardData: { files: [file], getData: () => '' } });
    await within(chat()).findByRole('img', { name: 'Image 1 of 1' });
    fireEvent.click(within(chat()).getByRole('button', { name: 'Send the stage as an image' }));
    await within(chat()).findByRole('img', { name: 'Image 2 of 2' });
    fireEvent.change(box, { target: { value: 'What is wrong here?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual(['What is wrong here?']));
    expect(imageCounts).toEqual([2]);
    await waitFor(() => expect(within(chat()).queryByRole('list', { name: 'Images attached to your message' })).toBeNull());
  });

  it('refuses a file that is not an image Claude can read', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([]);
    const box = screen.getByRole('textbox', { name: 'Message Claude' });
    fireEvent.paste(box, { clipboardData: { files: [new File(['x'], 'a.svg', { type: 'image/svg+xml' })], getData: () => '' } });
    expect(within(chat()).queryByRole('img', { name: /Image 1/ })).toBeNull();
  });
});

describe('LA-V99-R05-T01 The chat panel draws the picker, queue, chips, images, skills and review', () => {
  beforeEach(() => { chatDraft.write(''); chatChips.clear(); });

  it('draws each part where the panel puts it, and drops it when it is done with', async () => {
    const { push } = fakeChat();
    await openApp('/DM-SHOP-UC01');
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Go' }], 'running', 's-new', 'accept-reads', undefined, { choice: { model: 'haiku', effort: null }, queue: [{ id: 'q:1', text: 'Next', images: 1 }] });
    expect(within(chat()).getByRole('button', { name: 'Model and effort: Haiku' })).toBeInTheDocument();
    expect(within(chat()).getByRole('region', { name: 'Messages waiting for Claude' })).toHaveTextContent('1 image');
    act(() => chatChips.add('DM-SHOP-UC01'));
    expect(within(chat()).getByRole('list', { name: 'Records attached to your message' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Claude' }), { target: { value: '/' } });
    expect(await screen.findByRole('listbox', { name: 'Skills and slash commands' })).toBeInTheDocument();
    push([{ kind: 'user', images: 0, id: 'u1', text: 'Go' }], 'idle');
    expect(within(chat()).queryByRole('region', { name: 'Messages waiting for Claude' })).toBeNull();
    expect(screen.queryByRole('region', { name: "Review Claude's changes" })).toBeNull();
  });
});
