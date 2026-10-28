// The preload: the only bridge between the shell and the page. It runs sandboxed, so it imports
// nothing but Electron, and it exposes only window.latheDesktop (typed in app/src/shell/commands.tsx):
//   isDesktop           true, so the app can tell it runs in the desktop shell;
//   platform            the operating system ("darwin", "win32", "linux");
//   onCommand           subscribes to native menu choices, each sent as a command ID such as "stageGraph";
//   setChrome           sends the theme's { background, foreground } for the window's chrome (the main
//                       process checks them, desktop/src/chrome.ts);
//   onFullScreen        subscribes to the window entering and leaving full screen, called at once with
//                       the current state (macOS hides the traffic lights there);
//   setErrorCount       sends the product's number of check errors, for the Dock badge (dock.ts);
//   revealRecord, openRecordInEditor, copyRecordId, showRecordMenu
//                       the record actions, by record ID only (the main process checks the request and
//                       finds the data file itself, records.ts);
//   chat                the chat panel's Claude Code (LA-PLT-UC19): the folder's saved sessions, open one
//                       (new, resumed or forked), send a message, answer a permission prompt, stop the
//                       turn, and subscribe to the chat's patches (chat.ts);
//   onAppRequest        answers the app bridge's questions (bridge.ts): what the Reader is looking at,
//                       and opening a record, for Lathe's MCP tools run by the chat's Claude Code.
// Until the app subscribes, a menu choice presses the command's default keys in the page, so the
// app's keymap runs it as if typed.
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

type PatchListener = (patch: unknown) => void;
type AppRequestHandler = (request: unknown) => unknown;
const patchListeners = new Set<PatchListener>();
let appRequestHandler: AppRequestHandler | null = null;

ipcRenderer.on('lathe:chat', (_event, patch: unknown) => {
  for (const listener of patchListeners) listener(patch);
});

ipcRenderer.on('lathe:app-request', (_event, request: { id?: unknown }) => {
  const id = request?.id;
  if (typeof id !== 'string') return;
  const reply = (answer: unknown) => ipcRenderer.send('lathe:app-answer', { id, answer });
  if (!appRequestHandler) return reply(null);
  Promise.resolve()
    .then(() => appRequestHandler?.(request))
    .then(reply, () => reply(null));
});

const recordAction = (action: string) => (id: unknown) => {
  if (typeof id === 'string') ipcRenderer.send('lathe:record', { action, id });
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
  setErrorCount(count: unknown) {
    if (typeof count === 'number') ipcRenderer.send('lathe:error-count', count);
  },
  revealRecord: recordAction('reveal'),
  openRecordInEditor: recordAction('open-in-editor'),
  copyRecordId: recordAction('copy-id'),
  showRecordMenu: recordAction('menu'),
  chat: {
    sessions: () => ipcRenderer.invoke('lathe:chat-sessions'),
    open: (choice: unknown) => ipcRenderer.invoke('lathe:chat-open', choice),
    send: (text: unknown) => ipcRenderer.invoke('lathe:chat-send', text),
    answer: (id: unknown, allow: unknown) => ipcRenderer.invoke('lathe:chat-answer', { id, allow }),
    stop: () => ipcRenderer.invoke('lathe:chat-stop'),
    /** Subscribes to the chat's patches; the first is the whole chat, when there is one. */
    onPatch(listener: PatchListener) {
      if (typeof listener !== 'function') return () => {};
      patchListeners.add(listener);
      void ipcRenderer.invoke('lathe:chat-state').then((whole: unknown) => {
        if (whole && patchListeners.has(listener)) listener(whole);
      });
      return () => {
        patchListeners.delete(listener);
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
});
