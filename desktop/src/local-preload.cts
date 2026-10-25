// The preload of the shell's own pages (static/launch.html and static/about.html, launch.ts): it
// exposes only window.latheLocal.act(action), which sends a button's action to the main process. The
// main process runs it only when the page showed that button (parseLocalAction).
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('latheLocal', {
  act(action: unknown) {
    if (typeof action === 'string') ipcRenderer.send('lathe:local-action', action);
  },
});
