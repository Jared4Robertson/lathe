// The desktop shell's main process: one window per product folder, each loading Lathe from its own
// server (servers.ts), the native menus (menu.ts), and the recent folders and window states kept in
// the user data folder.
//
// Modes: `npm run start` and the packed app run serve() from the built Lathe package; `npm run dev`
// (LATHE_DESKTOP_DEV=1) loads the app's Vite dev server instead, so app changes hot-reload.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyChrome, chromeWindowOptions, type Chrome } from './chrome.ts';
import { keyPresses, MENU_COMMANDS } from './commands.ts';
import { addRecent, checkFolder, parseRecent, productNames, windowTitle } from './folders.ts';
import { menuTemplate } from './menu.ts';
import { serveModulePath, startDev, startServe, type AppServer } from './servers.ts';
import { runSmoke, smokeFile, writeSmoke } from './smoke.ts';
import { readJson, writeJson } from './store.ts';
import { MIN_SIZE, parseWindowStates, saveWindow, windowFor, type WindowStates } from './windowState.ts';

const DESKTOP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..');
const DEV = process.env.LATHE_DESKTOP_DEV === '1';
const SMOKE = smokeFile();

if (process.env.LATHE_DESKTOP_USER_DATA) app.setPath('userData', process.env.LATHE_DESKTOP_USER_DATA);
const RECENT_FILE = () => path.join(app.getPath('userData'), 'recent-folders.json');
const WINDOWS_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

const open = new Map<string, { win: BrowserWindow; server?: AppServer; chrome?: Chrome }>();
let recent: string[] = [];
let windowStates: WindowStates = {};
/** A folder dropped on the Dock icon before the app was ready. */
let dropped: string | undefined;

const log = (line: string) => {
  if (DEV) process.stdout.write(line.endsWith('\n') ? line : line + '\n');
};

function rememberRecent(list: string[]) {
  recent = list;
  writeJson(RECENT_FILE(), recent);
  refreshMenu();
}

function refreshMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        recent,
        openFolder: () => void chooseFolder(),
        openRecent: (folder) => void openFolder(folder),
        clearRecent: () => rememberRecent([]),
        runCommand: (id) => sendCommand(BrowserWindow.getFocusedWindow(), id),
      }),
    ),
  );
}

/** Sends a menu choice to a window's page as a command ID, with the keys that run it by default. */
function sendCommand(win: BrowserWindow | null, id: string) {
  const command = MENU_COMMANDS.find((c) => c.id === id);
  if (!win || !command) return;
  win.webContents.send('lathe:command', { id, presses: keyPresses(command.keys, process.platform === 'darwin') });
}

async function chooseFolder() {
  const parent = BrowserWindow.getFocusedWindow();
  const options = { title: 'Open Product Folder', buttonLabel: 'Open', properties: ['openDirectory' as const] };
  const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (!picked.canceled && picked.filePaths[0]) await openFolder(picked.filePaths[0]);
}

function fail(message: string) {
  if (SMOKE) {
    writeSmoke(SMOKE, { error: message });
    app.exit(1);
    return;
  }
  dialog.showErrorBox('Lathe cannot open this folder', message);
}

function saveBounds(folder: string, win: BrowserWindow) {
  if (win.isDestroyed()) return;
  windowStates = saveWindow(windowStates, folder, { ...win.getNormalBounds(), maximized: win.isMaximized(), fullScreen: win.isFullScreen() });
  writeJson(WINDOWS_FILE(), windowStates);
}

/** Links that leave the app open in the system browser; the window only ever shows the app. */
function keepLinksOutside(win: BrowserWindow, appUrl: string) {
  const origin = new URL(appUrl).origin;
  const openOutside = (url: string) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === origin) return;
    event.preventDefault();
    openOutside(url);
  });
}

async function openFolder(input: string) {
  const folder = path.resolve(input);
  const existing = open.get(folder);
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.focus();
    return;
  }
  const check = checkFolder(folder);
  if (!check.ok) return fail(check.message);
  rememberRecent(addRecent(recent, folder));

  const names = productNames(check.specsDir);
  const placed = windowFor(windowStates, folder, screen.getAllDisplays().map((d) => d.workArea));
  // No system title bar: the app draws its own, in the shell's color, so the window never flashes white.
  const chromeOptions = chromeWindowOptions(process.platform, nativeTheme.shouldUseDarkColors);
  const win = new BrowserWindow({
    ...placed,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    title: windowTitle(folder, names),
    ...chromeOptions,
    webPreferences: {
      preload: path.join(DESKTOP_DIR, 'out', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (process.platform === 'darwin') win.setRepresentedFilename(folder);
  const entry: { win: BrowserWindow; server?: AppServer; chrome?: Chrome } = { win };
  open.set(folder, entry);

  // The window keeps the product's name and folder, whatever the page calls itself.
  win.on('page-title-updated', (event) => event.preventDefault());
  let saveTimer: NodeJS.Timeout | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveBounds(folder, win), 400);
  };
  win.on('resize', saveSoon);
  win.on('move', saveSoon);
  win.on('close', () => {
    clearTimeout(saveTimer);
    saveBounds(folder, win);
  });
  win.on('closed', () => {
    entry.server?.stop();
    open.delete(folder);
  });
  win.once('ready-to-show', () => {
    if (SMOKE) return;
    if (placed.maximized) win.maximize();
    if (placed.fullScreen) win.setFullScreen(true);
    win.show();
  });

  try {
    entry.server = DEV ? await startDev(REPO_ROOT, folder, log) : await startServe(serveModulePath(REPO_ROOT, app.isPackaged ? { resourcesPath: process.resourcesPath } : null), folder);
  } catch (error) {
    win.destroy();
    return fail(error instanceof Error ? error.message : String(error));
  }
  if (win.isDestroyed()) return entry.server.stop();
  log(`Lathe: ${folder} from ${entry.server.label} at ${entry.server.url}`);
  keepLinksOutside(win, entry.server.url);

  if (SMOKE) {
    const smoke = runSmoke(win, names[0] ?? path.basename(folder), (id) => sendCommand(win, id), { titleBarStyle: chromeOptions.titleBarStyle, chrome: () => entry.chrome });
    void win.loadURL(entry.server.url);
    const result = await smoke.catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
    writeSmoke(SMOKE, result);
    app.quit();
    return;
  }
  await win.loadURL(entry.server.url).catch((error: unknown) => log(`Lathe: could not load ${entry.server?.url}: ${String(error)}`));
}

/** A folder named on the command line (`npm run dev -- ~/Development/client_sandbox`), if any. */
function folderArgument(argv: readonly string[]): string | undefined {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));
  return args.at(-1);
}

/** On launch: the folder on the command line, else the last folder opened, else (in this repo) Lathe itself, else the Open dialog. */
async function openOnLaunch() {
  const named = dropped ?? folderArgument(process.argv);
  dropped = undefined;
  if (named) return openFolder(named);
  const last = recent.find((f) => checkFolder(f).ok);
  if (last) return openFolder(last);
  if (!app.isPackaged) return openFolder(REPO_ROOT);
  return chooseFolder();
}

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const named = folderArgument(argv);
    if (named) void openFolder(named);
    else BrowserWindow.getAllWindows()[0]?.focus();
  });
  // A folder dropped on the Dock icon.
  app.on('open-file', (event, file) => {
    event.preventDefault();
    if (app.isReady()) void openFolder(file);
    else dropped = file;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || SMOKE) app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openOnLaunch();
  });
  app.on('before-quit', () => {
    for (const { server } of open.values()) server?.stop();
  });
  // Stopped from a terminal (or restarted by the dev watcher): quit properly, so dev servers stop too.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit());

  // The page's theme colors for its window's chrome (the preload's setChrome), checked before use.
  ipcMain.on('lathe:set-chrome', (event, input: unknown) => {
    const entry = [...open.values()].find((e) => !e.win.isDestroyed() && e.win.webContents === event.sender);
    if (!entry || event.senderFrame !== entry.win.webContents.mainFrame) return;
    const chrome = applyChrome(entry.win, process.platform, input);
    if (chrome) entry.chrome = chrome;
  });

  void app.whenReady().then(async () => {
    // The app needs no camera, location or notifications; it may copy text.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    recent = parseRecent(readJson(RECENT_FILE()));
    windowStates = parseWindowStates(readJson(WINDOWS_FILE()));
    refreshMenu();
    await openOnLaunch();
  });
}
