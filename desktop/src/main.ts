// The desktop shell's main process: one window per product folder, each loading Lathe from its own
// server (servers.ts), the native menus (menu.ts) and Dock (dock.ts), the launch view and error page
// over a window (launch.ts), the record actions (records.ts, editor.ts), and the recent folders,
// window states, chrome and settings kept in the user data folder.
//
// Modes: `npm run start` and the packed app run serve() from the built Lathe package; `npm run dev`
// (LATHE_DESKTOP_DEV=1) loads the app's Vite dev server instead, so app changes hot-reload.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, session, shell, systemPreferences, WebContentsView, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyChrome, chromeWindowOptions, parseSavedChrome, startChrome, type Chrome, type SavedChrome } from './chrome.ts';
import { commandKeys, keyPresses, MENU_COMMANDS, type KeyPress } from './commands.ts';
import { badgeFor, dockMenuTemplate, parseErrorCount } from './dock.ts';
import { editorLaunch, editorName, parseSettings, type Editor, type Settings } from './editor.ts';
import { addRecent, checkFolder, parseRecent, productNames, windowTitle } from './folders.ts';
import { routeOpenFile, routeSecondInstance, folderArgument } from './instance.ts';
import { aboutModel, errorModel, launchModel, launchStep, modelQuery, parseLocalAction, REFERENCE_URL, REPO_URL, specErrorMessage, type AboutModel, type LaunchModel, type LocalAction } from './launch.ts';
import { menuTemplate } from './menu.ts';
import { optOutOfWindowRestoration } from './persistence.ts';
import { DataFiles, parseRecordRequest, recordMenuTemplate } from './records.ts';
import { serveModulePath, settleWithin, startDev, startServe, type AppServer } from './servers.ts';
import { reloadInProgress, runSmoke, smokeFile, writeSmoke, type SmokeResult } from './smoke.ts';
import { readJson, writeJson } from './store.ts';
import { MIN_SIZE, parseWindowStates, saveWindow, windowFor, type WindowStates } from './windowState.ts';

const DESKTOP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..');
const STATIC_DIR = path.join(DESKTOP_DIR, 'static');
const LOCAL_PRELOAD = path.join(DESKTOP_DIR, 'out', 'local-preload.cjs');
const DEV = process.env.LATHE_DESKTOP_DEV === '1';
const SMOKE = smokeFile();
const MAC = process.platform === 'darwin';
/** How long the launch view waits for the page's specs before it says Lathe did not answer. */
const LAUNCH_TIMEOUT = 120_000;
/** The longest quitting waits for the windows' servers to stop (LA-PLT-UC11-R07). */
const QUIT_TIMEOUT = 10_000;

// Scroll bars float over the page, as the system's do.
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');
// Lathe reopens its own windows; macOS restores none, so a killed run leaves it nothing to ask about.
optOutOfWindowRestoration(process.platform, (key, type, value) => systemPreferences.setUserDefault(key, type, value));
// A smoke run quits gracefully when its test says "quit" on stdin.
if (SMOKE) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (text: string) => {
    if (text.split(/\s+/).includes('quit')) app.quit();
  });
  process.stdin.on('error', () => {});
}

if (process.env.LATHE_DESKTOP_USER_DATA) app.setPath('userData', process.env.LATHE_DESKTOP_USER_DATA);
const userFile = (name: string) => () => path.join(app.getPath('userData'), name);
const RECENT_FILE = userFile('recent-folders.json');
const WINDOWS_FILE = userFile('window-state.json');
const CHROME_FILE = userFile('chrome.json');
const SETTINGS_FILE = userFile('settings.json');

interface Entry {
  folder: string;
  product: string;
  win: BrowserWindow;
  server?: AppServer;
  chrome?: Chrome;
  /** The launch view or error page over the app's page, while it shows. */
  overlay?: { view: WebContentsView; model: LaunchModel };
  /** The text the launch view showed, for the smoke run. */
  launchSeen?: string;
  /** The product's check errors, as the page last reported them. */
  errors: number;
  dataFiles: DataFiles | null;
  /** Bumped on each launch, so an old watch stops. */
  launchRun: number;
}

const open = new Map<string, Entry>();
let recent: string[] = [];
let windowStates: WindowStates = {};
let savedChrome: SavedChrome = {};
let settings: Settings = parseSettings(undefined);
let lastFocused: number | null = null;
let about: { win: BrowserWindow; model: AboutModel } | null = null;
/** The Dock icon set at launch, for the smoke run. */
let dockIcon: { file: string; width: number; height: number } | null = null;
/** A folder dropped on the Dock icon before the app was ready. */
let dropped: string | undefined;

const log = (line: string) => {
  if (DEV) process.stdout.write(line.endsWith('\n') ? line : line + '\n');
};

/** The servers' stops in progress, closed windows' too, which quitting waits for. */
const stopping = new Set<Promise<void>>();

/** Stops a window's server, keeping its stop until it settles so quitting can wait for it. */
function stopServer(server: AppServer | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  const stop = server.stop().catch((error: unknown) => log(`Lathe: a server did not stop cleanly: ${String(error)}`));
  stopping.add(stop);
  void stop.finally(() => stopping.delete(stop));
  return stop;
}

const dark = () => nativeTheme.shouldUseDarkColors;
const entryOf = (contents: WebContents) => [...open.values()].find((e) => !e.win.isDestroyed() && e.win.webContents === contents);

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
        clearRecent: () => {
          app.clearRecentDocuments();
          rememberRecent([]);
        },
        runCommand: (id) => sendCommand(BrowserWindow.getFocusedWindow(), id),
        about: showAbout,
        settings: () => sendCommandId(focusedProductWindow(), 'openAppearance', []),
        settingsNow: settings,
        chooseEditor,
        editSettingsFile,
      }),
    ),
  );
}

/** The focused product window, or the one focused last while another (the About window) is in front. */
function focusedProductWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  const isProduct = (w: BrowserWindow | null | undefined) => !!w && [...open.values()].some((e) => e.win === w);
  if (isProduct(focused)) return focused;
  const last = lastFocused === null ? null : BrowserWindow.fromId(lastFocused);
  return isProduct(last) ? last : null;
}

/** Sends a menu choice to a window's page as a command ID, with the keys that run it by default. */
function sendCommand(win: BrowserWindow | null, id: string) {
  const command = MENU_COMMANDS.find((c) => c.id === id);
  if (command) sendCommandId(win, id, keyPresses(commandKeys(command, MAC), MAC));
}

function sendCommandId(win: BrowserWindow | null, id: string, presses: KeyPress[]) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('lathe:command', { id, presses });
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

/** A native Cut, Copy and Paste menu on text fields and selected text; record rows, nodes and titles get the page's record menu. */
function nativeTextMenu(win: BrowserWindow) {
  win.webContents.on('context-menu', (_event, params) => {
    let items: MenuItemConstructorOptions[] = [];
    if (params.isEditable) items = [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' }];
    else if (params.selectionText.trim()) items = [{ role: 'copy' }, { type: 'separator' }, { role: 'selectAll' }];
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
}

// --- The launch view and error page -------------------------------------------------------------

function currentColors(entry: Entry): Chrome {
  return entry.chrome ?? startChrome(savedChrome, dark());
}

function fitOverlay(entry: Entry) {
  if (!entry.overlay || entry.win.isDestroyed()) return;
  const [width, height] = entry.win.getContentSize();
  entry.overlay.view.setBounds({ x: 0, y: 0, width, height });
}

/** Shows a launch view or error page over the window's page, in a view of its own. */
async function showOverlay(entry: Entry, model: LaunchModel) {
  if (entry.win.isDestroyed()) return;
  if (!entry.overlay) {
    const view = new WebContentsView({ webPreferences: { preload: LOCAL_PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
    view.setBackgroundColor(model.colors.background);
    entry.win.contentView.addChildView(view);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    entry.overlay = { view, model };
    fitOverlay(entry);
  }
  entry.overlay.model = model;
  await entry.overlay.view.webContents.loadFile(path.join(STATIC_DIR, 'launch.html'), { query: modelQuery(model) }).catch(() => {});
  if (model.view === 'error') entry.overlay?.view.webContents.focus();
}

/** Lifts the launch view off the page, with a short fade, and gives the page the keyboard. */
async function hideOverlay(entry: Entry) {
  const overlay = entry.overlay;
  if (!overlay) return;
  entry.overlay = undefined;
  await overlay.view.webContents.executeJavaScript('document.body.classList.add("is-leaving")').catch(() => {});
  await new Promise((r) => setTimeout(r, 170));
  if (!entry.win.isDestroyed()) {
    entry.win.contentView.removeChildView(overlay.view);
    entry.win.webContents.focus();
  }
  overlay.view.webContents.close();
}

async function showError(entry: Entry, message: string) {
  await showOverlay(entry, errorModel(entry.product, entry.folder, message, currentColors(entry), process.platform));
}

/** Waits for the page to have the product's specs, then lifts the launch view, or shows the error page. */
async function watchLaunch(entry: Entry) {
  const run = ++entry.launchRun;
  const end = Date.now() + LAUNCH_TIMEOUT;
  while (Date.now() < end) {
    if (entry.win.isDestroyed() || run !== entry.launchRun) return;
    const specs = await entry.win.webContents.executeJavaScript("document.querySelector('.app')?.getAttribute('data-specs') ?? null").catch(() => null);
    const step = launchStep(specs);
    if (step === 'ready') return hideOverlay(entry);
    if (step === 'error') return showError(entry, await specError(entry));
    await new Promise((r) => setTimeout(r, 150));
  }
  if (run === entry.launchRun) await showError(entry, `Lathe did not answer within ${LAUNCH_TIMEOUT / 1000} s.`);
}

/** What the engine said when it could not load the folder. */
async function specError(entry: Entry): Promise<string> {
  if (!entry.server) return 'Lathe is not running for this folder.';
  try {
    const res = await fetch(`${entry.server.url}/api/spec`);
    return specErrorMessage(res.status, await res.json().catch(() => null));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Starts the folder's server, if it has none, and loads the app under the launch view. */
async function startApp(entry: Entry): Promise<void> {
  if (!entry.server) {
    try {
      entry.server = DEV ? await startDev(REPO_ROOT, entry.folder, log) : await startServe(serveModulePath(REPO_ROOT, app.isPackaged ? { resourcesPath: process.resourcesPath } : null), entry.folder);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (SMOKE) return fail(message);
      return showError(entry, message);
    }
    if (entry.win.isDestroyed()) return stopServer(entry.server);
    log(`Lathe: ${entry.folder} from ${entry.server.label} at ${entry.server.url}`);
    keepLinksOutside(entry.win, entry.server.url);
  }
  const url = entry.server.url;
  const loading = entry.win.loadURL(url);
  void watchLaunch(entry);
  await loading.catch((error: unknown) => {
    log(`Lathe: could not load ${url}: ${String(error)}`);
    entry.launchRun++;
    void showError(entry, `The page did not load from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function retry(entry: Entry) {
  await showOverlay(entry, launchModel(entry.product, currentColors(entry)));
  await startApp(entry);
}

function runLocalAction(entry: Entry, action: LocalAction) {
  if (action === 'retry') void retry(entry);
  else if (action === 'open-another') void chooseFolder();
  else if (action === 'reveal') shell.showItemInFolder(entry.folder);
}

// --- Windows -------------------------------------------------------------------------------------

async function openFolder(input: string) {
  const folder = path.resolve(input);
  const existing = open.get(folder);
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.show();
    existing.win.focus();
    return;
  }
  const check = checkFolder(folder);
  if (!check.ok) return fail(check.message);
  rememberRecent(addRecent(recent, folder));
  app.addRecentDocument(folder);

  const names = productNames(check.dataDir);
  const placed = windowFor(windowStates, folder, screen.getAllDisplays().map((d) => d.workArea));
  // No system title bar: the app draws its own, in the shell's color, so the window never flashes white.
  const chromeOptions = chromeWindowOptions(process.platform, dark(), savedChrome);
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
      spellcheck: false,
    },
  });
  if (MAC) win.setRepresentedFilename(folder);
  const entry: Entry = { folder, product: names.length === 1 ? names[0] : path.basename(folder), win, errors: 0, dataFiles: new DataFiles(check.dataDir), launchRun: 0 };
  open.set(folder, entry);

  // The window keeps the product's name and folder, whatever the page calls itself.
  win.on('page-title-updated', (event) => event.preventDefault());
  let saveTimer: NodeJS.Timeout | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveBounds(folder, win), 400);
  };
  win.on('resize', () => {
    fitOverlay(entry);
    saveSoon();
  });
  win.on('move', saveSoon);
  // Full screen is remembered, and the page told, as macOS hides the traffic lights there.
  const sendFullScreen = () => {
    if (!win.isDestroyed()) win.webContents.send('lathe:full-screen', win.isFullScreen());
  };
  win.on('enter-full-screen', () => {
    sendFullScreen();
    fitOverlay(entry);
    saveSoon();
  });
  win.on('leave-full-screen', () => {
    sendFullScreen();
    fitOverlay(entry);
    saveSoon();
  });
  win.webContents.on('did-finish-load', sendFullScreen);
  win.on('focus', () => {
    lastFocused = win.id;
    updateBadge();
  });
  win.on('close', () => {
    clearTimeout(saveTimer);
    saveBounds(folder, win);
  });
  win.on('closed', () => {
    void stopServer(entry.server);
    open.delete(folder);
    if (lastFocused === entry.win.id) lastFocused = null;
    updateBadge();
  });
  nativeTextMenu(win);

  // The launch view shows at once, over the shell color; the window shows with it.
  const launch = showOverlay(entry, launchModel(entry.product, currentColors(entry)));
  void launch.then(async () => {
    if (SMOKE) {
      entry.launchSeen = await entry.overlay?.view.webContents.executeJavaScript('document.body.innerText').catch(() => undefined);
      return;
    }
    if (win.isDestroyed() || win.isVisible()) return;
    if (placed.maximized) win.maximize();
    if (placed.fullScreen) win.setFullScreen(true);
    win.show();
  });

  if (SMOKE) {
    await launch;
    const smoke = runSmoke(win, entry.product, (id) => sendCommand(win, id), {
      titleBarStyle: chromeOptions.titleBarStyle,
      chrome: () => entry.chrome,
      launch: () => ({ seen: entry.launchSeen, showing: !!entry.overlay }),
      dockIcon: () => dockIcon,
    });
    void startApp(entry);
    const result: SmokeResult = await smoke.catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
    // It quits while a reload is in progress, as the reader might (LA-PLT-UC11-R07).
    if (entry.server) result.reloadAtQuit = await reloadInProgress(entry.server.url, entry.folder);
    writeSmoke(SMOKE, result);
    app.quit();
    return;
  }
  await startApp(entry);
}

// --- Record actions, the Dock and About ----------------------------------------------------------

function openInEditor(file: string) {
  settings = parseSettings(readJson(SETTINGS_FILE()));
  const launch = editorLaunch(settings, file, process.platform);
  const failed = (message: string) => {
    void dialog.showMessageBox({ type: 'warning', message: `Lathe couldn't open the data file in ${editorName(settings)}.`, detail: `${message}\n\nChoose another editor in File › Open Records In.` });
  };
  if (launch.kind === 'open-path') {
    void shell.openPath(launch.path).then((error) => error && failed(error));
    return;
  }
  execFile(launch.file, launch.args, { env: { ...process.env, LATHE_FILE: file } }, (error, _stdout, stderr) => {
    if (error) failed(String(stderr).trim() || error.message);
  });
}

function runRecordAction(entry: Entry, input: unknown) {
  const request = parseRecordRequest(input);
  if (!request) return;
  const file = entry.dataFiles?.find(request.id) ?? null;
  const reveal = () => file && shell.showItemInFolder(file);
  const edit = () => file && openInEditor(file);
  const copy = () => clipboard.writeText(request.id);
  if (request.action === 'reveal') reveal();
  else if (request.action === 'open-in-editor') edit();
  else if (request.action === 'copy-id') copy();
  else Menu.buildFromTemplate(recordMenuTemplate(request.id, !!file, editorName(settings), { reveal, openInEditor: edit, copyId: copy }, process.platform)).popup({ window: entry.win });
}

function chooseEditor(editor: Editor) {
  settings = parseSettings({ ...(readJson(SETTINGS_FILE()) as object | undefined), editor });
  writeJson(SETTINGS_FILE(), settings);
  refreshMenu();
}

function editSettingsFile() {
  const file = SETTINGS_FILE();
  if (!existsSync(file)) writeJson(file, { ...settings, editorCommand: settings.editorCommand ?? '' });
  void shell.openPath(file);
}

function updateBadge() {
  if (!MAC || !app.dock) return;
  const counts = new Map([...open.values()].filter((e) => !e.win.isDestroyed()).map((e) => [e.win.id, e.errors]));
  const focused = BrowserWindow.getFocusedWindow();
  app.dock.setBadge(badgeFor(counts, focused && counts.has(focused.id) ? focused.id : null, lastFocused));
}

/** The engine's version, from the package serve() comes from. */
function engineVersion(): string | null {
  const serve = serveModulePath(REPO_ROOT, app.isPackaged ? { resourcesPath: process.resourcesPath } : null);
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(path.dirname(serve), '..', '..', '..', 'package.json'), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function showAbout() {
  if (about && !about.win.isDestroyed()) {
    about.win.show();
    about.win.focus();
    return;
  }
  const colors = startChrome(savedChrome, dark());
  const model = aboutModel({ app: app.getVersion(), engine: engineVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }, colors);
  const win = new BrowserWindow({
    width: 300,
    height: 330,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'About Lathe',
    show: false,
    backgroundColor: colors.background,
    ...(MAC ? { titleBarStyle: 'hidden' as const } : { autoHideMenuBar: true }),
    webPreferences: { preload: LOCAL_PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  about = { win, model };
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    about = null;
  });
  void win.loadFile(path.join(STATIC_DIR, 'about.html'), { query: modelQuery(model) });
}

/** The Dock icon of an unpacked app (the packed app has its own): the DEV variant in development. */
function setDockIcon() {
  if (!MAC || app.isPackaged || !app.dock) return;
  const file = path.join(DESKTOP_DIR, 'build', DEV ? 'icon-dev.png' : 'icon.png');
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return;
  app.dock.setIcon(image);
  dockIcon = { file, ...image.getSize() };
}

/** On launch: the folder on the command line, else the last folder opened, else (in this repo) Lathe itself, else the Open dialog. */
async function openOnLaunch() {
  const named = dropped ?? folderArgument(process.argv, app.isPackaged);
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
  // A second launch: open (or focus) its folder, or bring the app forward.
  app.on('second-instance', (_event, argv, workingDirectory) => {
    const route = routeSecondInstance(argv, workingDirectory, app.isPackaged);
    if (route.kind === 'open') return void openFolder(route.folder);
    const win = focusedProductWindow() ?? [...open.values()][0]?.win;
    if (!win) return void openOnLaunch();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  // A folder opened through Finder or dropped on the Dock icon.
  app.on('open-file', (event, file) => {
    event.preventDefault();
    const route = routeOpenFile(file, app.isReady());
    if (route.kind === 'open') void openFolder(route.folder);
    else dropped = route.folder;
  });
  app.on('window-all-closed', () => {
    if (!MAC || SMOKE) app.quit();
  });
  app.on('activate', () => {
    if (open.size === 0) void openOnLaunch();
  });
  // Quitting waits until every window's server has stopped, so no database work outlives the process, and then
  // quits again; a server that hangs is given up on after QUIT_TIMEOUT (LA-PLT-UC11-R07).
  let quit: 'running' | 'stopping' | 'stopped' = 'running';
  app.on('before-quit', (event) => {
    if (quit === 'stopped') return;
    event.preventDefault();
    if (quit === 'stopping') return;
    quit = 'stopping';
    for (const { server } of open.values()) void stopServer(server);
    void settleWithin([...stopping], QUIT_TIMEOUT).then((all) => {
      if (!all) log(`Lathe: quitting without waiting longer for a server to stop (${QUIT_TIMEOUT / 1000} s).`);
      quit = 'stopped';
      app.quit();
    });
  });
  // Stopped from a terminal (or restarted by the dev watcher): quit properly, so dev servers stop too.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit());

  // Every message from a page is checked: it must come from a product window's own page (not a frame in it).
  const fromPage = (event: Electron.IpcMainEvent) => {
    const entry = entryOf(event.sender);
    return entry && event.senderFrame === entry.win.webContents.mainFrame ? entry : undefined;
  };

  // The page's theme colors for its window's chrome (the preload's setChrome), checked before use.
  ipcMain.on('lathe:set-chrome', (event, input: unknown) => {
    const entry = fromPage(event);
    if (!entry) return;
    const chrome = applyChrome(entry.win, process.platform, input);
    if (!chrome) return;
    entry.chrome = chrome;
    entry.overlay?.view.setBackgroundColor(chrome.background);
    const mode = dark() ? 'dark' : 'light';
    if (savedChrome[mode]?.background !== chrome.background || savedChrome[mode]?.foreground !== chrome.foreground) {
      savedChrome = { ...savedChrome, [mode]: chrome };
      writeJson(CHROME_FILE(), savedChrome);
    }
  });
  ipcMain.on('lathe:error-count', (event, input: unknown) => {
    const entry = fromPage(event);
    const count = parseErrorCount(input);
    if (!entry || count === null) return;
    entry.errors = count;
    updateBadge();
  });
  ipcMain.on('lathe:record', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) runRecordAction(entry, input);
  });
  // A button on a launch view, error page or the About window, run only when that page shows it.
  ipcMain.on('lathe:local-action', (event, input: unknown) => {
    const entry = [...open.values()].find((e) => e.overlay?.view.webContents === event.sender);
    if (entry?.overlay) {
      const action = parseLocalAction(input, entry.overlay.model.actions);
      if (action) runLocalAction(entry, action);
      return;
    }
    if (about && about.win.webContents === event.sender) {
      const action = parseLocalAction(input, about.model.actions);
      if (action === 'open-repo') void shell.openExternal(REPO_URL);
      if (action === 'open-reference') void shell.openExternal(REFERENCE_URL);
    }
  });

  void app.whenReady().then(async () => {
    // The app needs no camera, location or notifications; it may copy text.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    recent = parseRecent(readJson(RECENT_FILE()));
    windowStates = parseWindowStates(readJson(WINDOWS_FILE()));
    savedChrome = parseSavedChrome(readJson(CHROME_FILE()));
    settings = parseSettings(readJson(SETTINGS_FILE()));
    setDockIcon();
    if (MAC) app.dock?.setMenu(Menu.buildFromTemplate(dockMenuTemplate({ newWindow: () => void chooseFolder() })));
    app.setAboutPanelOptions({ applicationName: 'Lathe', applicationVersion: app.getVersion() });
    refreshMenu();
    await openOnLaunch();
  });
}
