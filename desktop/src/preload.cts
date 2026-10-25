// The preload: the only bridge between the shell and the page. It runs sandboxed, so it imports
// nothing but Electron, and it exposes only window.latheDesktop:
//   isDesktop  true, so the app can tell it runs in the desktop shell;
//   platform   the operating system ("darwin", "win32", "linux");
//   onCommand  subscribes to native menu choices, each sent as a command ID such as "viewWiki".
// Until the app subscribes, a menu choice presses the command's default keys in the page, so the
// app's keymap runs it as if typed.
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

type KeyPress = { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean };
type Listener = (id: string) => void;

const listeners = new Set<Listener>();

ipcRenderer.on('lathe:command', (_event, message: { id: string; presses: KeyPress[] }) => {
  if (listeners.size > 0) {
    for (const listener of listeners) listener(message.id);
    return;
  }
  for (const press of message.presses) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { ...press, bubbles: true, cancelable: true }));
  }
});

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
});
