// The preload: the only bridge between the shell and the page. It runs sandboxed, so it imports
// nothing but Electron (and the bridge's type, which is erased), and it exposes only window.latheDesktop,
// whose members are described in app/src/shell/desktop-bridge.ts; the object below ends in
// `satisfies LatheDesktop`, so the two cannot drift. Each record action, app question and chat call has
// its own channel (the main process checks every request: chat.ts, voice.ts, bridge.ts, chrome.ts,
// menu.ts, dock.ts, product-window/commands/). Until the app subscribes to onCommand, a menu choice
// presses the command's default keys in the page, so the app's keymap runs it as if typed.
import type { AppRequest, ChatPatch, LatheDesktop, VoiceEvent } from 'lathe-desktop-bridge';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

type KeyPress = { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean };
type Listener = (id: string) => void;
type FullScreenListener = (fullScreen: boolean) => void;

const listeners = new Set<Listener>();
const fullScreenListeners = new Set<FullScreenListener>();
let fullScreen = false;

ipcRenderer.on('lathe:command', (_event, message: { id: string; presses: KeyPress[] }) => {
  if (listeners.size > 0) {
    for (const listener of listeners) listener(message.id);
    return;
  }
  for (const press of message.presses) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { ...press, bubbles: true, cancelable: true }));
  }
});

ipcRenderer.on('lathe:full-screen', (_event, value: unknown) => {
  fullScreen = value === true;
  for (const listener of fullScreenListeners) listener(fullScreen);
});

type PatchListener = (patch: ChatPatch) => void;
type AppRequestHandler = (request: AppRequest) => unknown;
const patchListeners = new Set<PatchListener>();
let appRequestHandler: AppRequestHandler | null = null;

ipcRenderer.on('lathe:chat', (_event, patch: ChatPatch) => {
  for (const listener of patchListeners) listener(patch);
});

type VoiceListener = (event: VoiceEvent) => void;
const voiceListeners = new Set<VoiceListener>();
ipcRenderer.on('lathe:voice', (_event, voiceEvent: VoiceEvent) => {
  for (const listener of voiceListeners) listener(voiceEvent);
});

// The app bridge's questions, each on its own channel, answered on the same channel with the question's id.
// The page's handler gets the question as the app types it: { kind: 'focus' } or { kind: 'open', open }.
const answerOn = (channel: string, kind: AppRequest['kind']) => (_event: unknown, request: { id?: unknown; open: Extract<AppRequest, { kind: 'open' }>['open'] }) => {
  const id = request?.id;
  if (typeof id !== 'string') return;
  const reply = (answer: unknown) => ipcRenderer.send(channel, { id, answer });
  if (!appRequestHandler) return reply(null);
  Promise.resolve()
    .then(() => appRequestHandler?.(kind === 'open' ? { kind, open: request.open } : { kind }))
    .then(reply, () => reply(null));
};
ipcRenderer.on('lathe:ask-focus', answerOn('lathe:ask-focus', 'focus'));
ipcRenderer.on('lathe:ask-open', answerOn('lathe:ask-open', 'open'));

// Each record action on its own channel, with the record's ID only.
const recordAction = (channel: string) => (id: unknown) => {
  if (typeof id === 'string') ipcRenderer.send(channel, { id });
};

contextBridge.exposeInMainWorld('latheDesktop', {
  isDesktop: true,
  platform: process.platform,
  onCommand(listener: Listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setChrome(chrome: { background: unknown; foreground: unknown }) {
    if (typeof chrome !== 'object' || chrome === null) return;
    ipcRenderer.send('lathe:set-chrome', { background: chrome.background, foreground: chrome.foreground });
  },
  onFullScreen(listener: FullScreenListener) {
    if (typeof listener !== 'function') return () => {};
    fullScreenListeners.add(listener);
    listener(fullScreen);
    return () => {
      fullScreenListeners.delete(listener);
    };
  },
  setMenuKeys(keys: unknown) {
    if (typeof keys === 'object' && keys !== null) ipcRenderer.send('lathe:menu-keys', keys);
  },
  setErrorCount(count: unknown) {
    if (typeof count === 'number') ipcRenderer.send('lathe:error-count', count);
  },
  revealRecord: recordAction('lathe:reveal-record'),
  openRecordInEditor: recordAction('lathe:open-record-in-editor'),
  copyRecordId: recordAction('lathe:copy-record-id'),
  showRecordMenu: recordAction('lathe:show-record-menu'),
  chat: {
    sessions: () => ipcRenderer.invoke('lathe:chat-sessions'),
    open: (choice: unknown) => ipcRenderer.invoke('lathe:chat-open', choice),
    send: (text: unknown, focus: unknown, images: unknown) => ipcRenderer.invoke('lathe:chat-send', { text, focus, images }),
    setModel: (model: unknown, effort: unknown) => ipcRenderer.invoke('lathe:chat-model', { model, effort }),
    unqueue: (id: unknown) => ipcRenderer.invoke('lathe:chat-unqueue', id),
    skills: () => ipcRenderer.invoke('lathe:chat-skills'),
    captureStage: (rect: unknown) => ipcRenderer.invoke('lathe:chat-capture', rect),
    answer: (id: unknown, answer: unknown) => ipcRenderer.invoke('lathe:chat-answer', { id, answer }),
    stop: () => ipcRenderer.invoke('lathe:chat-stop'),
    setMode: (mode: unknown) => ipcRenderer.invoke('lathe:chat-mode', mode),
    /** Subscribes to the chat's patches; the first is the whole chat, when there is one. */
    onPatch(listener: PatchListener) {
      if (typeof listener !== 'function') return () => {};
      patchListeners.add(listener);
      void ipcRenderer.invoke('lathe:chat-state').then((whole: ChatPatch | null) => {
        if (whole && patchListeners.has(listener)) listener(whole);
      });
      return () => {
        patchListeners.delete(listener);
      };
    },
  },
  voice: {
    support: () => ipcRenderer.invoke('lathe:voice-support'),
    listen: (on: unknown) => ipcRenderer.invoke('lathe:voice-listen', on === true),
    onEvent(listener: VoiceListener) {
      if (typeof listener !== 'function') return () => {};
      voiceListeners.add(listener);
      return () => {
        voiceListeners.delete(listener);
      };
    },
  },
  onAppRequest(handler: AppRequestHandler) {
    if (typeof handler !== 'function') return () => {};
    appRequestHandler = handler;
    return () => {
      if (appRequestHandler === handler) appRequestHandler = null;
    };
  },
} satisfies LatheDesktop);
