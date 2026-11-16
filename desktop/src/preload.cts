// The preload: the only bridge between the shell and the page. It runs sandboxed, so it imports
// nothing but Electron (and the bridge's type, which is erased), and it exposes only window.latheDesktop,
// whose members are described in app/src/shell/desktop-bridge.ts; the object below ends in
// `satisfies LatheDesktop`, so the two cannot drift. Each record action has its own channel (the main
// process checks every request: chrome.ts, menu.ts, dock.ts, product-window/commands/). Until the app subscribes to onCommand, a menu choice
// presses the command's default keys in the page, so the app's keymap runs it as if typed.
import type { LatheDesktop } from 'lathe-desktop-bridge';

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
} satisfies LatheDesktop);
