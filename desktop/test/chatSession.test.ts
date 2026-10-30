// The chat's process with a stand-in CLI (fixtures/fake-claude.mjs), which speaks the real CLI's lines.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMode, ChatState } from '../src/chat.ts';
import { ChatSession, type CountedTools } from '../src/chatSession.ts';

const fake = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-claude.mjs');
const sessions: ChatSession[] = [];
const seen: { args: string[]; cwd: string }[] = [];

const counted: NodeJS.ProcessEnv[] = [];

function session(mode: ChatMode = 'accept-reads') {
  let resolveNext: (() => void) | null = null;
  let predicate: ((s: ChatState) => boolean) | null = null;
  const chat = new ChatSession({
    command: process.execPath,
    cwd: process.cwd(),
    env: process.env,
    setup: { pluginDir: '/apps/Lathe/plugin', mode },
    countTools: async (env): Promise<CountedTools> => {
      counted.push(env);
      return { lathe: { status: 'loaded', version: '2.0.0', count: env.LATHE_VIEW_ONLY === '1' ? 40 : 120 }, reads: ['mcp__plugin_lathe_lathe__use_case_get_use_case'] };
    },
    onChange: (state) => {
      if (predicate?.(state)) {
        predicate = null;
        resolveNext?.();
      }
    },
    spawn: (command, args, options) => {
      seen.push({ args, cwd: options.cwd });
      return spawn(command, [fake, ...args], { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    },
  });
  sessions.push(chat);
  const until = (p: (s: ChatState) => boolean) =>
    p(chat.state) ? Promise.resolve() : new Promise<void>((resolve) => {
      predicate = p;
      resolveNext = resolve;
    });
  return { chat, until };
}

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((s) => s.close()));
  seen.length = 0;
  counted.length = 0;
});

describe('LA-PLT-UC19-R01-T01 The chat runs the Owner\'s own Claude Code in the folder and continues its session', () => {
  it('sends a message, streams the answer, and names the session', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    expect(chat.send('What is SMK-ORD?')).toBe(true);
    await until((s) => s.status === 'idle');
    expect(chat.state.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(chat.state.items[0]).toEqual({ kind: 'user', id: expect.any(String), text: 'What is SMK-ORD?', images: 0 });
    expect(chat.state.items[1]).toMatchObject({ kind: 'assistant', streaming: false });
    expect((chat.state.items[1] as { text: string }).text).toContain('**SMK-ORD**');
    expect(seen[0].cwd).toBe(process.cwd());
  });

  it('resumes a saved session with its history, and starts the CLI again on it after it ends', async () => {
    const { chat, until } = session();
    const id = '11111111-2222-3333-4444-555555555555';
    chat.open({ resume: id }, [{ kind: 'user', id: 'u:saved:0', text: 'Earlier', images: 0 }]);
    expect(seen[0].args).toContain('--resume');
    expect(chat.state).toMatchObject({ sessionId: id, items: [{ text: 'Earlier' }] });
    await chat.close();
    expect(chat.state.status).toBe('closed');
    chat.send('hello');
    await until((s) => s.status === 'idle');
    expect(seen[1].args.slice(-2)).toEqual(['--resume', id]);
    expect(chat.state.sessionId).toBe(id);
  });

  it('forks a session under a new ID', async () => {
    const { chat, until } = session();
    const id = '11111111-2222-3333-4444-555555555555';
    chat.open({ resume: id, fork: true }, []);
    expect(seen[0].args.slice(-3)).toEqual(['--resume', id, '--fork-session']);
    chat.send('hello');
    await until((s) => s.status === 'idle');
    expect(chat.state.sessionId).not.toBe(id);
  });
});

describe('LA-PLT-UC19-R04-T01 A permission prompt waits for the Owner, and Stop ends the turn', () => {
  it('runs the tool once allowed', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('ask permission');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    const prompt = chat.state.items.find((i) => i.kind === 'permission')!;
    expect(prompt).toMatchObject({ tool: 'Bash', summary: 'touch notes.txt', answer: 'pending' });
    expect(chat.answer(prompt.id, 'once')).toBe(true);
    await until((s) => s.status === 'idle');
    expect(chat.state.items.find((i) => i.id === prompt.id)).toMatchObject({ answer: 'allowed' });
    expect(chat.state.items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'done', result: 'Created notes.txt.' });
    expect(chat.answer(prompt.id, 'deny')).toBe(false);
  });

  it('does not run the tool when denied', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('ask permission');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    chat.answer(chat.state.items.find((i) => i.kind === 'permission')!.id, 'deny');
    await until((s) => s.status === 'idle');
    expect(chat.state.items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'error' });
  });

  it('stops a turn under way, withdrawing its prompt', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('ask permission');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    expect(chat.stop()).toBe(true);
    expect(chat.state.status).toBe('stopping');
    await until((s) => s.status === 'idle');
    expect(chat.state.items.find((i) => i.kind === 'permission')).toMatchObject({ answer: 'canceled' });
    expect(chat.state.items.at(-1)).toMatchObject({ kind: 'notice', text: 'Stopped.' });
    // The next message goes to the same process.
    expect(chat.send('hello')).toBe(true);
    await until((s) => s.status === 'idle');
    expect(seen).toHaveLength(1);
  });

  it('says so when the CLI cannot be started', async () => {
    const chat = new ChatSession({ command: '/no/such/claude', cwd: process.cwd(), env: process.env, setup: { pluginDir: '/apps/Lathe/plugin', mode: 'accept-reads' }, onChange: () => {} });
    sessions.push(chat);
    chat.open({}, []);
    await new Promise((r) => setTimeout(r, 200));
    expect(chat.state.status).toBe('closed');
    expect(chat.state.items.at(-1)).toMatchObject({ kind: 'notice', tone: 'error' });
  });
});

describe('LA-PLT-UC19-R09-T04 The mode changes on the open session, and the panel answers prompts by it', () => {
  it('starts in the mode it is given, View only with only the reads counted, and loads Lathe\'s plugin either way', async () => {
    const { chat, until } = session('view-only');
    chat.open({}, []);
    expect(seen[0].args).toEqual(expect.arrayContaining(['--plugin-dir', '/apps/Lathe/plugin', '--disallowedTools']));
    await until((s) => s.lathe.status === 'loaded');
    expect(chat.state).toMatchObject({ mode: 'view-only', lathe: { status: 'loaded', version: '2.0.0', count: 40 } });
    expect(counted[0].LATHE_VIEW_ONLY).toBe('1');
  });

  it('starts the CLI again on the same session when the mode changes, says so, and counts the tools again', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('hello');
    await until((s) => s.status === 'idle' && !!s.sessionId);
    const id = chat.state.sessionId;
    expect(chat.setMode('view-only')).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1].args).toEqual(expect.arrayContaining(['--disallowedTools', '--resume', id]));
    expect(chat.state.items.at(-1)).toMatchObject({ kind: 'notice', text: 'View only: Claude can read the spec but not change it.' });
    await until((s) => s.lathe.status === 'loaded' && s.lathe.count === 40);
    // The same mode again starts nothing.
    expect(chat.setMode('view-only')).toBe(true);
    expect(seen).toHaveLength(2);
    expect(chat.setMode('bypass')).toBe(true);
    expect(seen[2].args).toEqual(expect.arrayContaining(['--permission-mode', 'bypassPermissions']));
    expect(chat.state.sessionId).toBe(id);
  });

  it('is refused while a turn is under way', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('slow');
    await until((s) => s.status === 'running');
    expect(chat.setMode('view-only')).toBe(false);
    expect(chat.state.mode).toBe('accept-reads');
  });

  it('in View only, refuses a prompt for a tool that may change things, saying why, and the tool does not run', async () => {
    const { chat, until } = session('view-only');
    chat.open({}, []);
    chat.send('write a note');
    await until((s) => s.status === 'idle' && s.items.some((i) => i.kind === 'tool' && i.status !== 'running'));
    const prompt = chat.state.items.find((i) => i.kind === 'permission');
    expect(prompt).toMatchObject({ tool: 'mcp__notes__write_note', answer: 'refused', reason: expect.stringContaining('This chat is View only, so notes write_note was refused') });
    expect(chat.state.items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'error', result: expect.stringContaining('View only') });
  });

  it('in Accept reads, runs a Lathe query without a prompt once the tools are counted, and asks for a write', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    await until((s) => s.lathe.status === 'loaded');
    chat.send('read the use case');
    await until((s) => s.status === 'idle' && s.items.some((i) => i.kind === 'tool' && i.status === 'done'));
    expect(chat.state.items.some((i) => i.kind === 'permission')).toBe(false);
    chat.send('write a note');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    expect(chat.state.items.find((i) => i.kind === 'permission')).toMatchObject({ answer: 'pending' });
  });

  it('in Ask, asks even for a read', async () => {
    const { chat, until } = session('ask');
    chat.open({}, []);
    await until((s) => s.lathe.status === 'loaded');
    chat.send('read the use case');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    expect(chat.state.items.find((i) => i.kind === 'permission')).toMatchObject({ tool: 'mcp__plugin_lathe_lathe__use_case_get_use_case', answer: 'pending' });
  });
});

describe('LA-PLT-UC19-R11-T02 Allow always in this chat: one approval per tool', () => {
  it('allows the tool, and its next prompt in the chat runs without asking', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('run it twice');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    const first = chat.state.items.find((i) => i.kind === 'permission')!;
    expect(chat.answer(first.id, 'always')).toBe(true);
    await until((s) => s.status === 'idle');
    expect(chat.state.items.filter((i) => i.kind === 'permission')).toMatchObject([{ id: first.id, answer: 'always' }]);
    expect(chat.state.items.filter((i) => i.kind === 'tool')).toMatchObject([{ status: 'done' }, { status: 'done', result: '1b8c43d5 Merge 183-serves' }]);
  });
});

describe('LA-PLT-UC19-R12-T03 A message goes with what the Owner is looking at', () => {
  it('sends the focus with the message, and the chat shows only the message', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('What does this need?', 'Product: TL\nFocused record: TL-LEND-UC01 (use case): Borrow a tool');
    await until((s) => s.status === 'idle');
    expect(chat.state.items[0]).toMatchObject({ kind: 'user', text: 'What does this need?' });
    expect(chat.state.items[1]).toMatchObject({ kind: 'assistant', text: 'You are looking at **TL-LEND-UC01**, so I started from it without a tool call.' });
    expect(chat.state.items.some((i) => i.kind === 'tool')).toBe(false);
  });
});

describe('LA-PLT-UC19-R16-T01 A message typed while Claude works is queued and sent in order', () => {
  it('queues messages while a turn is under way, lists them, and sends each as the turn before it ends', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('slow');
    await until((s) => s.status === 'running');
    expect(chat.send('first queued')).toBe(true);
    expect(chat.send('second queued', 'Page: /x')).toBe(true);
    expect(chat.state.queue.map((m) => m.text)).toEqual(['first queued', 'second queued']);
    // One is taken back out before it goes.
    expect(chat.unqueue(chat.state.queue[1].id)).toBe(true);
    expect(chat.unqueue('q:nope')).toBe(false);
    expect(chat.state.queue.map((m) => m.text)).toEqual(['first queued']);
    await until((s) => s.queue.length === 0 && s.status === 'idle' && s.items.filter((i) => i.kind === 'user').length === 2);
    expect(chat.state.items.filter((i) => i.kind === 'user').map((i) => (i as { text: string }).text)).toEqual(['slow', 'first queued']);
  });
});

describe('LA-PLT-UC19-R15-T01 The model and effort the Owner chooses are the CLI\'s flags, on the same session', () => {
  it('starts the CLI again with --model and --effort, says so, and refuses while a turn is under way', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('hello');
    await until((s) => s.status === 'idle');
    const id = chat.state.sessionId;
    expect(chat.setChoice({ model: 'opus', effort: 'high' })).toBe(true);
    expect(chat.state.choice).toEqual({ model: 'opus', effort: 'high' });
    chat.send('again');
    await until((s) => s.status === 'idle' && s.items.some((i) => i.kind === 'user' && i.text === 'again'));
    const args = seen.at(-1)!.args;
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual(['--model', 'opus']);
    expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'high']);
    expect(args).toContain(id);
    expect(chat.state.items.some((i) => i.kind === 'notice' && i.text.includes('opus, high effort'))).toBe(true);
    chat.send('slow');
    await until((s) => s.status === 'running');
    expect(chat.setChoice({ model: null, effort: null })).toBe(false);
  });
});
