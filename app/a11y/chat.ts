import type { Page } from '@playwright/test';

// The desktop app's chat panel (LA-PLT-UC19, LA-V99) in a browser: a stand-in for the desktop shell's
// bridge (window.latheDesktop), with a chat that holds one of each kind of item, so the audit and the
// keyboard tests reach the panel the web app never draws. The session setting opens the chat. The
// stand-in answers like the shell: a message makes the chat busy, Stop ends the turn.

/** Gives the page a desktop bridge with a chat about `record`, open or at its session picker. */
export async function withChat(page: Page, record: string, open: 'conversation' | 'picker' = 'conversation') {
  await page.addInitScript(({ record, open }) => {
    const settings = { layout: 'tree', depth: 1, hiddenKinds: [], minimap: false, card: true, cardWidth: null, cardExpanded: false, chat: true, chatWidth: null, lens: false, since: 'commit', follow: false, looked: {} };
    window.sessionStorage.setItem('lathe:session-settings', JSON.stringify(settings));
    type Item = Record<string, unknown> & { id: string };
    let items: Item[] = [
      { kind: 'user', id: 'u1', text: `What does ${record} need?` },
      { kind: 'assistant', id: 'a1', text: `**${record}** needs a test for each requirement.\n\n- Its flow covers the steps.\n- Ask me to add the tests.`, streaming: false },
      { kind: 'tool', id: 't1', name: 'mcp__plugin_lathe_lathe__show', label: 'lathe show', summary: record, input: `{\n  "id": "${record}"\n}`, result: `${record}: shown`, status: 'done' },
      { kind: 'permission', id: 'p1', tool: 'Bash', label: 'Bash', summary: 'npm --prefix lathe run check', input: '{\n  "command": "npm --prefix lathe run check"\n}', reason: 'This command runs a script.', answer: 'pending' },
      { kind: 'notice', id: 'n1', text: 'Stopped.', tone: 'info' },
    ];
    let status = 'idle';
    let listener: ((patch: unknown) => void) | null = null;
    const emit = (reset: boolean) => listener?.({ reset, sessionId: 'session-1', status, items: items.map((item, at) => ({ at, item })) });
    const sessions = {
      claude: '/usr/local/bin/claude',
      configured: false,
      current: open === 'conversation' ? 'session-1' : null,
      sessions: [
        { id: 'session-1', title: `Tests for ${record}`, updated: Date.now() - 5 * 60_000, openElsewhere: null },
        { id: 'session-2', title: 'Plan the graph stage', updated: Date.now() - 26 * 3_600_000, openElsewhere: 'running' },
      ],
    };
    const chat = {
      sessions: async () => sessions,
      open: async () => { setTimeout(() => emit(true), 0); return true; },
      send: async (text: string) => { items = [...items, { kind: 'user', id: `u${items.length}`, text }]; status = 'running'; emit(false); return true; },
      answer: async (id: string, allow: boolean) => { items = items.map((i) => (i.id === id ? { ...i, answer: allow ? 'allowed' : 'denied' } : i)); emit(false); return true; },
      stop: async () => { status = 'idle'; items = [...items, { kind: 'notice', id: `n${items.length}`, text: 'Stopped.', tone: 'info' }]; emit(false); return true; },
      onPatch: (l: (patch: unknown) => void) => { listener = l; if (open === 'conversation') setTimeout(() => emit(true), 0); return () => { listener = null; }; },
    };
    const none = () => () => {};
    (window as unknown as { latheDesktop: unknown }).latheDesktop = {
      isDesktop: true, platform: 'darwin', onCommand: none, setChrome: () => {}, onFullScreen: (l: (v: boolean) => void) => { l(false); return () => {}; },
      setErrorCount: () => {}, revealRecord: () => {}, openRecordInEditor: () => {}, copyRecordId: () => {}, showRecordMenu: () => {},
      chat, onAppRequest: none,
    };
  }, { record, open });
}
