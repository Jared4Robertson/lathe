// The Window chat aggregate (LA-PLT-A16): its repository keeps the chats in memory and each folder's chat mode in
// chat-modes.json, its commands go through it, its rule keeps one chat per window, and a closed window's chat ends.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '../src/chatSession.ts';
import type { VoiceListener } from '../src/voice.ts';
import { chooseChatMode } from '../src/window-chat/commands/choose-chat-mode.ts';
import { chooseChatModel } from '../src/window-chat/commands/choose-chat-model.ts';
import { listenForVoice } from '../src/window-chat/commands/listen-for-voice.ts';
import { openChatSession } from '../src/window-chat/commands/open-chat-session.ts';
import { sendMessageToClaude } from '../src/window-chat/commands/send-message-to-claude.ts';
import { parseChatModes, startingMode, type WindowChat } from '../src/window-chat/model.ts';
import { onWindowClosedEndChat } from '../src/window-chat/policies.ts';
import { WindowChatRepository } from '../src/window-chat/repository.ts';
import { windowChatProblems } from '../src/window-chat/rules.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-window-chat-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const file = (name: string) => () => path.join(temp, name);
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(temp, name), 'utf8'));

/** A session that records what it is asked, and refuses a change of mode while busy. */
function fakeSession(busy = { now: false }) {
  const calls: string[] = [];
  const session = {
    state: { choice: { model: 'opus', effort: 'high' } },
    open: vi.fn((start: unknown) => void calls.push(`open ${JSON.stringify(start)}`)),
    close: vi.fn(async () => void calls.push('close')),
    send: vi.fn(() => true),
    setMode: vi.fn(() => !busy.now),
    setChoice: vi.fn(() => true),
  };
  return { session: session as unknown as ChatSession, fake: session, calls };
}

describe('LA-PLT-INV45-T Each window has one chat: opening a session ends the one the chat ran', () => {
  it('opens a session in the mode the folder\'s last chat had and with the model chosen, ending the one before', async () => {
    const chats = new WindowChatRepository({ modes: file('m1.json') });
    expect(chooseChatMode(chats, { folder: '/p/a', mode: 'view-only' })).toBe(true);
    const first = fakeSession();
    const create = vi.fn(async () => ({ session: first.session, history: [] }));
    expect(await openChatSession(chats, { folder: '/p/a', request: { mode: 'new' }, create })).toBe(true);
    expect(create).toHaveBeenLastCalledWith({ mode: 'new' }, { mode: 'view-only', choice: undefined });
    expect(first.calls).toEqual(['open {}']);
    const second = fakeSession();
    expect(await openChatSession(chats, { folder: '/p/a', request: { mode: 'resume', id: 's1' }, create: async () => ({ session: second.session, history: [] }) })).toBe(true);
    expect(first.calls).toEqual(['open {}', 'close']);
    expect(second.calls).toEqual(['open {"resume":"s1","fork":false}']);
    expect(chats.load().open.get('/p/a')?.session).toBe(second.session);
    expect(await openChatSession(chats, { folder: '/p/a', request: { mode: 'fork' }, create })).toBe(false);
    expect(await openChatSession(chats, { folder: '/p/a', request: { mode: 'new' }, create: async () => null })).toBe(false);
    expect(chats.load().open.get('/p/a')?.session).toBe(second.session);
  });

  it('refuses a chat kept under another folder, or another window\'s session', () => {
    const { session } = fakeSession();
    const open = new Map<string, WindowChat>([['/p/a', { folder: '/p/b', sent: null }], ['/p/c', { folder: '/p/c', sent: null, session }], ['/p/d', { folder: '/p/d', sent: null, session }]]);
    expect(windowChatProblems({ open, stopping: new Set(), modes: {} }).map((p) => p.message)).toEqual(['The chat of /p/b is kept under /p/a.', 'The chat of /p/d runs another window\'s session.']);
  });

});

describe('LA-PLT-PO04-T A closed window\'s chat ends', () => {
  it('ends a closed window\'s chat, its session and its listening, keeping the stop until it settles', async () => {
    const chats = new WindowChatRepository({ modes: file('m2.json') });
    const { session, calls } = fakeSession();
    await openChatSession(chats, { folder: '/p/a', request: { mode: 'new' }, create: async () => ({ session, history: [] }) });
    const voice = { want: vi.fn(() => 'listening'), close: vi.fn(async () => {}) };
    expect(await listenForVoice(chats, { folder: '/p/a', on: true, ask: true, allowed: async () => ({ may: 'allowed', reason: null }), listener: () => voice as unknown as VoiceListener })).toEqual({ listening: 'listening', reason: null });
    const ending = onWindowClosedEndChat({ folder: '/p/a' }, chats);
    expect(chats.load().stopping.size).toBe(1);
    await ending;
    await Promise.resolve();
    expect(calls).toContain('close');
    expect(voice.close).toHaveBeenCalled();
    expect(chats.load().open.has('/p/a')).toBe(false);
    expect(chats.load().stopping.size).toBe(0);
  });
});

describe('LA-PLT-UC19-R09-T05 A folder\'s chat starts in the mode its last chat had: Accept reads at first', () => {
  it('LA-PLT-A16-SR01-T01 keeps the mode in chat-modes.json, by folder, leaving out the default, and a new repository reads it back', () => {
    const chats = new WindowChatRepository({ modes: file('m3.json') });
    expect(startingMode(chats.load().modes, '/p/c')).toBe('accept-reads');
    expect(chooseChatMode(chats, { folder: '/p/c', mode: 'view-only' })).toBe(true);
    expect(json('m3.json')).toEqual({ '/p/c': 'view-only' });
    const again = new WindowChatRepository({ modes: file('m3.json') }).load();
    expect(startingMode(again.modes, '/p/c/')).toBe('view-only');
    expect(startingMode(again.modes, '/p/d')).toBe('accept-reads');
    expect(chooseChatMode(chats, { folder: '/p/c', mode: 'accept-reads' })).toBe(true);
    expect(json('m3.json')).toEqual({});
  });

  it('changes the open session\'s mode too, and is refused when the session refuses (a turn under way) or for a mode Lathe does not know', async () => {
    const chats = new WindowChatRepository({ modes: file('m4.json') });
    const busy = { now: true };
    const { session, fake } = fakeSession(busy);
    await openChatSession(chats, { folder: '/p/e', request: { mode: 'new' }, create: async () => ({ session, history: [] }) });
    expect(chooseChatMode(chats, { folder: '/p/e', mode: 'bypass' })).toBe(false);
    expect(chats.load().modes).toEqual({});
    busy.now = false;
    expect(chooseChatMode(chats, { folder: '/p/e', mode: 'bypass' })).toBe(true);
    expect(fake.setMode).toHaveBeenLastCalledWith('bypass');
    expect(chats.load().modes).toEqual({ '/p/e': 'bypass' });
    expect(chooseChatMode(chats, { folder: '/p/e', mode: 'yolo' })).toBe(false);
  });

  it('reads back only full paths with a mode Lathe knows', () => {
    expect(parseChatModes({ '/p/b': 'ask', relative: 'auto', '/p/c': 'yolo', '/p/a/': 'bypass', '/p/d': 'accept-reads' })).toEqual({ '/p/a': 'bypass', '/p/b': 'ask' });
    expect(parseChatModes(['/p/a'])).toEqual({});
  });
});

describe('LA-PLT-UC22-R03-T04 The chat\'s commands take only what the page may send, and only in a window with a session', () => {
  it('sends only text with pictures the chat takes, and chooses only a model and effort Lathe knows, and only in a window with a session', async () => {
    const chats = new WindowChatRepository({ modes: file('m5.json') });
    expect(sendMessageToClaude(chats, { folder: '/p/f', message: { text: 'hi' } })).toBe(false);
    const { session, fake } = fakeSession();
    await openChatSession(chats, { folder: '/p/f', request: { mode: 'new' }, create: async () => ({ session, history: [] }) });
    expect(sendMessageToClaude(chats, { folder: '/p/f', message: { text: 'hi', focus: 'LA-MOD-UC02' } })).toBe(true);
    expect(fake.send).toHaveBeenLastCalledWith('hi', 'LA-MOD-UC02', []);
    expect(sendMessageToClaude(chats, { folder: '/p/f', message: { text: 3 } })).toBe(false);
    expect(chooseChatModel(chats, { folder: '/p/f', choice: { model: 'sonnet', effort: null } })).toBe(true);
    expect(chooseChatModel(chats, { folder: '/p/f', choice: { model: 'gpt', effort: null } })).toBe(false);
    expect(fake.setChoice).toHaveBeenCalledTimes(1);
  });
});

describe('LA-PLT-UC20-R01-T02 Listening is refused with why where this Mac cannot dictate, and answered unasked until macOS may ask for the microphone', () => {
  const voice = () => ({ want: vi.fn(() => 'listening'), close: vi.fn(async () => {}) });

  it('refuses with the reason, making no listener, where the Mac cannot recognize on-device', async () => {
    const chats = new WindowChatRepository({ modes: file('m3.json') });
    const listener = vi.fn(() => voice() as unknown as VoiceListener);
    const reason = 'On-device dictation needs macOS 26 or later.';
    expect(await listenForVoice(chats, { folder: '/p/a', on: true, ask: true, allowed: async () => ({ may: 'unavailable', reason }), listener })).toEqual({ listening: 'unavailable', reason });
    expect(listener).not.toHaveBeenCalled();
    expect(chats.load().open.has('/p/a')).toBe(false);
  });

  it('passes on whether macOS may ask, answers unasked or denied without listening, and listens once allowed', async () => {
    const chats = new WindowChatRepository({ modes: file('m4.json') });
    const asks: boolean[] = [];
    const listener = vi.fn(() => voice() as unknown as VoiceListener);
    const allowed = async (ask: boolean) => { asks.push(ask); return ask ? { may: 'allowed' as const, reason: null } : { may: 'unasked' as const, reason: null }; };
    expect(await listenForVoice(chats, { folder: '/p/a', on: true, ask: false, allowed, listener })).toEqual({ listening: 'unasked', reason: null });
    expect(await listenForVoice(chats, { folder: '/p/a', on: true, ask: true, allowed: async () => ({ may: 'denied', reason: null }), listener })).toEqual({ listening: 'denied', reason: null });
    expect(listener).not.toHaveBeenCalled();
    expect(await listenForVoice(chats, { folder: '/p/a', on: true, ask: true, allowed, listener })).toEqual({ listening: 'listening', reason: null });
    expect(asks).toEqual([false, true]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
