// The chat's process with a stand-in CLI (fixtures/fake-claude.mjs), which speaks the real CLI's lines.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatState } from '../src/chat.ts';
import { ChatSession } from '../src/chatSession.ts';

const fake = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-claude.mjs');
const sessions: ChatSession[] = [];
const seen: { args: string[]; cwd: string }[] = [];

function session() {
  let resolveNext: (() => void) | null = null;
  let predicate: ((s: ChatState) => boolean) | null = null;
  const chat = new ChatSession({
    command: process.execPath,
    cwd: process.cwd(),
    env: process.env,
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
});

describe('LA-PLT-UC19-R01-T01 The chat runs the Owner\'s own Claude Code in the folder and continues its session', () => {
  it('sends a message, streams the answer, and names the session', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    expect(chat.send('What is SMK-ORD?')).toBe(true);
    await until((s) => s.status === 'idle');
    expect(chat.state.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(chat.state.items[0]).toEqual({ kind: 'user', id: expect.any(String), text: 'What is SMK-ORD?' });
    expect(chat.state.items[1]).toMatchObject({ kind: 'assistant', streaming: false });
    expect((chat.state.items[1] as { text: string }).text).toContain('**SMK-ORD**');
    expect(seen[0].cwd).toBe(process.cwd());
  });

  it('resumes a saved session with its history, and starts the CLI again on it after it ends', async () => {
    const { chat, until } = session();
    const id = '11111111-2222-3333-4444-555555555555';
    chat.open({ resume: id }, [{ kind: 'user', id: 'u:saved:0', text: 'Earlier' }]);
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
    expect(chat.answer(prompt.id, true)).toBe(true);
    await until((s) => s.status === 'idle');
    expect(chat.state.items.find((i) => i.id === prompt.id)).toMatchObject({ answer: 'allowed' });
    expect(chat.state.items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'done', result: 'Created notes.txt.' });
    expect(chat.answer(prompt.id, false)).toBe(false);
  });

  it('does not run the tool when denied', async () => {
    const { chat, until } = session();
    chat.open({}, []);
    chat.send('ask permission');
    await until((s) => s.items.some((i) => i.kind === 'permission'));
    chat.answer(chat.state.items.find((i) => i.kind === 'permission')!.id, false);
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
    const chat = new ChatSession({ command: '/no/such/claude', cwd: process.cwd(), env: process.env, onChange: () => {} });
    sessions.push(chat);
    chat.open({}, []);
    await new Promise((r) => setTimeout(r, 200));
    expect(chat.state.status).toBe('closed');
    expect(chat.state.items.at(-1)).toMatchObject({ kind: 'notice', tone: 'error' });
  });
});
