// The preload of the shell's own pages (static/launch.html and static/about.html, launch.ts): it
// exposes only window.latheLocal.act(action), which sends a button's action to the main process on the
// channel of the command it runs (LOCAL_ACTION_CHANNELS in launch.ts). The main process runs it only when
// the page showed that button (parseLocalAction). About's links open through the window's open handler.
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

// Kept in step with launch.ts's LOCAL_ACTION_CHANNELS: a sandboxed preload imports nothing but Electron.
const CHANNELS: Record<string, string> = {
  retry: 'lathe:retry-app-server',
  'open-another': 'lathe:open-product-folder',
  reveal: 'lathe:reveal-product-folder',
};

contextBridge.exposeInMainWorld('latheLocal', {
  act(action: unknown) {
    const channel = typeof action === 'string' && Object.hasOwn(CHANNELS, action) ? CHANNELS[action] : undefined;
    if (channel) ipcRenderer.send(channel, action);
  },
});
