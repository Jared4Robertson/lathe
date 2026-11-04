import type { Page } from '@playwright/test';
import { asDesktop } from '../stability/desktop';

// The desktop app's chat panel (LA-PLT-UC19, LA-V99) in a browser: the shared stand-in for the desktop shell's
// bridge (stability/desktop.ts), with a chat that holds one of each kind of item, so the audit and the
// keyboard tests reach the panel the web app never draws. The session setting opens the chat. The
// stand-in answers like the shell: a message makes the chat busy, Stop ends the turn, a mode is taken.

/** Gives the page a desktop bridge with a chat about `record`, open or at its session picker. */
export async function withChat(page: Page, record: string, open: 'conversation' | 'picker' = 'conversation') {
  await asDesktop(page, (bridge, { record, open }) => {
    type Chat = import('../src/chat/types').ChatBridge;
    type Patch = import('../src/chat/types').ChatPatch;
    type Item = import('../src/chat/types').ChatItem;
    const settings = { layout: 'tree', minimap: false, allLinks: false, cardWidth: null, chat: true, chatWidth: null, highlight: false, since: 'commit', follow: false, looked: {} };
    window.sessionStorage.setItem('lathe:session-settings', JSON.stringify(settings));
    let items: Item[] = [
      { kind: 'user', id: 'u1', text: `What does ${record} need?`, images: 0 },
      { kind: 'assistant', id: 'a1', text: `**${record}** needs a test for each requirement.\n\n- Its flow covers the steps.\n- Ask me to add the tests.`, streaming: false },
      { kind: 'tool', id: 't1', name: 'mcp__plugin_lathe_lathe__show', label: 'lathe show', summary: record, input: `{\n  "id": "${record}"\n}`, result: `${record}: shown`, status: 'done' },
      { kind: 'permission', id: 'p1', tool: 'Bash', label: 'Bash', summary: 'npm --prefix lathe run check', input: '{\n  "command": "npm --prefix lathe run check"\n}', reason: 'This command runs a script.', answer: 'pending' },
      { kind: 'notice', id: 'n1', text: 'Stopped.', tone: 'info' },
    ];
    let status: Patch['status'] = 'idle';
    let mode: Patch['mode'] = 'accept-reads';
    let listener: ((patch: Patch) => void) | null = null;
    const lathe: Patch['lathe'] = { status: 'loaded', version: '2.0.0', count: 142 };
    const emit = (reset: boolean) => listener?.({ reset, sessionId: 'session-1', status, mode, choice: { model: null, effort: null }, lathe, queue: [], signedOut: false, items: items.map((item, at) => ({ at, item })) });
    const sessions = {
      claude: '/usr/local/bin/claude',
      configured: false,
      signedIn: true,
      signIn: { status: 'idle', method: null, url: null, asksForCode: false, problem: null } as const,
      mode,
      current: open === 'conversation' ? 'session-1' : null,
      sessions: [
        { id: 'session-1', title: `Tests for ${record}`, updated: Date.now() - 5 * 60_000, openElsewhere: null },
        { id: 'session-2', title: 'Plan the graph stage', updated: Date.now() - 26 * 3_600_000, openElsewhere: 'running' as const },
      ],
    };
    const chat: Chat = {
      ...bridge.chat,
      sessions: async () => sessions,
      open: async () => { setTimeout(() => emit(true), 0); return true; },
      send: async (text) => { items = [...items, { kind: 'user', id: `u${items.length}`, text, images: 0 }]; status = 'running'; emit(false); return true; },
      answer: async (id, answer) => { items = items.map((i) => (i.id === id && i.kind === 'permission' ? { ...i, answer: answer === 'once' ? 'allowed' : answer === 'always' ? 'always' : 'denied' } : i)); emit(false); return true; },
      setMode: async (next) => { mode = next; emit(false); return true; },
      stop: async () => { status = 'idle'; items = [...items, { kind: 'notice', id: `n${items.length}`, text: 'Stopped.', tone: 'info' }]; emit(false); return true; },
      onPatch: (l) => { listener = l; if (open === 'conversation') setTimeout(() => emit(true), 0); return () => { listener = null; }; },
    };
    bridge.chat = chat;
  }, { record, open });
}
