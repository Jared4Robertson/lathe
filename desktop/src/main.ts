// The desktop shell's main process: one window per product folder, each loading Lathe from its own
// server (servers.ts), the native menus (menu.ts) and Dock (dock.ts), the launch view and error page
// over a window (launch.ts), the record actions (records.ts, editor.ts), the chat panel's Claude Code
// (chatSession.ts, claudeSessions.ts) and the app bridge its tools reach the window by (bridge.ts). It only
// wires Electron to the aggregates' commands, policies and queries: the open windows, their places and chrome
// (product-window/), their servers (app-server/), the recent folders (recent-folders/) and the shell's settings
// (shell-settings/), each kept by its own repository, the only code that reaches its storage.
//
// Modes: `npm run start` and the packed app run serve() from the built Lathe package; `npm run dev`
// (LATHE_DESKTOP_DEV=1) loads the app's Vite dev server instead, so app changes hot-reload.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, session, shell, systemPreferences, WebContentsView, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeProductWindow } from './product-window/commands/close-product-window.ts';
import { copyRecordId } from './product-window/commands/copy-record-id.ts';
import { openProductFolder } from './product-window/commands/open-product-folder.ts';
import { openRecordDataFile } from './product-window/commands/open-record-data-file.ts';
import { reportErrorCount } from './product-window/commands/report-error-count.ts';
import { revealProductFolder } from './product-window/commands/reveal-product-folder.ts';
import { revealRecordDataFile } from './product-window/commands/reveal-record-data-file.ts';
import { saveWindowPlace } from './product-window/commands/save-window-place.ts';
import { setWindowChrome } from './product-window/commands/set-window-chrome.ts';
import { showRecordMenu } from './product-window/commands/show-record-menu.ts';
import type { WindowClosedReactions, WindowOpenedReactions } from './product-window/events.ts';
import { MIN_SIZE, windowFor, type OpenWindow } from './product-window/model.ts';
import { ProductWindowRepository } from './product-window/repository.ts';
import { startAppServer } from './app-server/commands/start-app-server.ts';
import { stopAppServer } from './app-server/commands/stop-app-server.ts';
import type { RunningServer } from './app-server/model.ts';
import { onWindowClosedStopAppServer, onWindowOpenedStartAppServer } from './app-server/policies.ts';
import { AppServerRepository } from './app-server/repository.ts';
import { clearRecentFolders } from './recent-folders/commands/clear-recent-folders.ts';
import { onWindowOpenedAddRecentFolder } from './recent-folders/policies.ts';
import { listRecentFolders } from './recent-folders/queries.ts';
import { recentFoldersReader } from './recent-folders/reader.ts';
import { RecentFolderRepository } from './recent-folders/repository.ts';
import { chooseEditor } from './shell-settings/commands/choose-editor.ts';
import { openSettingsFile } from './shell-settings/commands/open-settings-file.ts';
import type { Editor } from './shell-settings/model.ts';
import { ShellSettingsRepository } from './shell-settings/repository.ts';
import { startBridge, type Bridge, type OpenAnswer, type OpenRequest } from './bridge.ts';
import { chatPatch, transcriptItems } from './chat.ts';
import { ChatSession } from './chatSession.ts';
import { findClaude, listSessions, processAlive, runningSessions, transcriptFile } from './claudeSessions.ts';
import { chromeWindowOptions, startChrome, type Chrome } from './chrome.ts';
import { commandKeys, keyPresses, MENU_COMMANDS, type KeyPress } from './commands.ts';
import { badgeFor, dockMenuTemplate } from './dock.ts';
import { editorLaunch, editorName } from './editor.ts';
import { checkFolder, productNames, windowTitle } from './folders.ts';
import { routeOpenFile, routeSecondInstance, folderArgument } from './instance.ts';
import { aboutLink, aboutModel, errorModel, launchModel, launchStep, modelQuery, parseLocalAction, specErrorMessage, type AboutModel, type LaunchModel, type LocalAction } from './launch.ts';
import { menuTemplate } from './menu.ts';
import { optOutOfWindowRestoration } from './persistence.ts';
import { DataFiles, recordMenuTemplate } from './records.ts';
import { latheFor, latheLabel, packageVersion, serveModulePath, settleWithin, startDev, startServe } from './servers.ts';
import { reloadInProgress, runSmoke, smokeFile, writeSmoke, type SmokeResult } from './smoke.ts';

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

// The aggregates' repositories: the only code that reaches their storage.
const productWindows = new ProductWindowRepository({ places: userFile('window-state.json'), chrome: userFile('chrome.json') });
const appServers = new AppServerRepository();
const recentFolders = new RecentFolderRepository(userFile('recent-folders.json'));
const shellSettings = new ShellSettingsRepository(userFile('settings.json'));
/** The open windows, by folder. */
const openWindows = () => productWindows.load().open;

let lastFocused: number | null = null;
let about: { win: BrowserWindow; model: AboutModel } | null = null;
/** The Dock icon set at launch, for the smoke run. */
let dockIcon: { file: string; width: number; height: number } | null = null;
/** A folder dropped on the Dock icon before the app was ready. */
let dropped: string | undefined;

const log = (line: string) => {
  if (DEV) process.stdout.write(line.endsWith('\n') ? line : line + '\n');
};

/** The chats' stops in progress, which quitting waits for beside the servers' (app-server/). */
const chatStops = new Set<Promise<void>>();

const dark = () => nativeTheme.shouldUseDarkColors;
const entryOf = (contents: WebContents) => [...openWindows().values()].find((e) => !e.win.isDestroyed() && e.win.webContents === contents);

/** The recent folders, through their read model's reader. */
const recentList = () => listRecentFolders(recentFoldersReader(recentFolders.load()));

function refreshMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        recent: recentList(),
        openFolder: () => void chooseFolder(),
        openRecent: (folder) => void openFolder(folder),
        clearRecent: clearRecentMenu,
        runCommand: (id) => sendCommand(BrowserWindow.getFocusedWindow(), id),
        about: showAbout,
        settings: () => sendCommandId(focusedProductWindow(), 'openAppearance', []),
        settingsNow: shellSettings.load(),
        chooseEditor: pickEditor,
        editSettingsFile: () => openSettingsFile(shellSettings, (file) => void shell.openPath(file)),
      }),
    ),
  );
}

/** File › Open Recent › Clear Menu: Clear the recent folders, and the system's recent documents with them. */
function clearRecentMenu() {
  app.clearRecentDocuments();
  clearRecentFolders(recentFolders);
  refreshMenu();
}

/** File › Open Records In: Choose an editor. */
function pickEditor(editor: Editor) {
  chooseEditor(shellSettings, { editor });
  refreshMenu();
}

/** The focused product window, or the one focused last while another (the About window) is in front. */
function focusedProductWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  const isProduct = (w: BrowserWindow | null | undefined) => !!w && [...openWindows().values()].some((e) => e.win === w);
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

/** Save a window's place, as it is now. */
function keepWindowPlace(folder: string, win: BrowserWindow) {
  if (win.isDestroyed()) return;
  saveWindowPlace(productWindows, { folder, place: { ...win.getNormalBounds(), maximized: win.isMaximized(), fullScreen: win.isFullScreen() } });
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

function currentColors(entry: OpenWindow): Chrome {
  return entry.chrome ?? startChrome(productWindows.load().chrome, dark());
}

function fitOverlay(entry: OpenWindow) {
  if (!entry.overlay || entry.win.isDestroyed()) return;
  const [width, height] = entry.win.getContentSize();
  entry.overlay.view.setBounds({ x: 0, y: 0, width, height });
}

/** Shows a launch view or error page over the window's page, in a view of its own. */
async function showOverlay(entry: OpenWindow, model: LaunchModel) {
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
async function hideOverlay(entry: OpenWindow) {
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

async function showError(entry: OpenWindow, message: string) {
  await showOverlay(entry, errorModel(entry.product, entry.folder, message, currentColors(entry), process.platform));
}

/** Waits for the page to have the product's specs, then lifts the launch view, or shows the error page. */
async function watchLaunch(entry: OpenWindow) {
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
async function specError(entry: OpenWindow): Promise<string> {
  const running = appServers.load().running.get(entry.folder);
  if (!running) return 'Lathe is not running for this folder.';
  try {
    const res = await fetch(`${running.server.url}/api/spec`);
    return specErrorMessage(res.status, await res.json().catch(() => null));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Starts a folder's server: serve() on the product's own installed Lathe or the bundled copy, or in development a dev server. */
async function startServerFor(folder: string): Promise<RunningServer> {
  if (DEV) return { server: await startDev(REPO_ROOT, folder, log), lathe: 'Lathe from source' };
  // The product's own installed Lathe when it has one, else the app's bundled copy.
  const lathe = latheFor(folder, bundledServe());
  return { server: await startServe(lathe.modulePath, folder), lathe: latheLabel(lathe) };
}

/** Runs Start a window's app server for its folder, and loads the app under the launch view. */
async function serveWindow(folder: string): Promise<void> {
  const entry = openWindows().get(folder);
  if (!entry) return;
  const fresh = !appServers.load().running.has(folder);
  let running: RunningServer;
  try {
    running = await startAppServer(appServers, { folder, start: () => startServerFor(folder) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (SMOKE) return fail(message);
    return showError(entry, message);
  }
  if (entry.win.isDestroyed()) return stopAppServer(appServers, { folder }, log);
  if (fresh) {
    log(`Lathe: ${folder} from ${running.server.label} (${running.lathe}) at ${running.server.url}`);
    keepLinksOutside(entry.win, running.server.url);
  }
  const url = running.server.url;
  const loading = entry.win.loadURL(url);
  void watchLaunch(entry);
  await loading.catch((error: unknown) => {
    log(`Lathe: could not load ${url}: ${String(error)}`);
    entry.launchRun++;
    void showError(entry, `The page did not load from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  });
}

/** The error page's Retry: the launch view again, and the window's server started again when it has none. */
async function retry(entry: OpenWindow) {
  await showOverlay(entry, launchModel(entry.product, currentColors(entry)));
  await serveWindow(entry.folder);
}

/** What a window opened and closed set off: its policies, called in order by the commands that raise the events. */
const windowOpenedReactions: WindowOpenedReactions = {
  onWindowOpenedAddRecentFolder: (event) => onWindowOpenedAddRecentFolder(event, recentFolders, { addRecentDocument: (folder) => app.addRecentDocument(folder), recentFoldersChanged: refreshMenu }),
  onWindowOpenedStartAppServer: (event) => onWindowOpenedStartAppServer(event, serveWindow),
};
const windowClosedReactions: WindowClosedReactions = {
  onWindowClosedStopAppServer: (event) => onWindowClosedStopAppServer(event, appServers, log),
};

// --- Windows -------------------------------------------------------------------------------------

async function openFolder(input: string) {
  const folder = path.resolve(input);
  const existing = openWindows().get(folder);
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.show();
    existing.win.focus();
    return;
  }
  const check = checkFolder(folder);
  if (!check.ok) return fail(check.message);

  const names = productNames(check.dataDirs);
  const { places, chrome: savedChrome } = productWindows.load();
  const placed = windowFor(places, folder, screen.getAllDisplays().map((d) => d.workArea));
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
  const entry: OpenWindow = { folder, product: names.length === 1 ? names[0] : path.basename(folder), win, errors: 0, dataFiles: new DataFiles(check.dataDirs), launchRun: 0, key: randomUUID(), chatSent: null };

  // The window keeps the product's name and folder, whatever the page calls itself.
  win.on('page-title-updated', (event) => event.preventDefault());
  let saveTimer: NodeJS.Timeout | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => keepWindowPlace(folder, win), 400);
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
    keepWindowPlace(folder, win);
  });
  const id = win.id;
  win.on('closed', () => windowClosed(entry, id));
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

  if (!SMOKE) return openProductFolder(productWindows, { window: entry }, windowOpenedReactions);
  await launch;
  const smoke = runSmoke(win, entry.product, (command) => sendCommand(win, command), {
    titleBarStyle: chromeOptions.titleBarStyle,
    chrome: () => entry.chrome,
    launch: () => ({ seen: entry.launchSeen, showing: !!entry.overlay }),
    dockIcon: () => dockIcon,
  });
  void openProductFolder(productWindows, { window: entry }, windowOpenedReactions);
  const result: SmokeResult = await smoke.catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
  // It quits while a reload is in progress, as the reader might (LA-PLT-UC11-R07).
  const running = appServers.load().running.get(folder);
  if (running) result.reloadAtQuit = await reloadInProgress(running.server.url, entry.folder);
  writeSmoke(SMOKE, result);
  app.quit();
}

/** A window closed: Close a product window (which stops its server), and its chat stopped. */
function windowClosed(entry: OpenWindow, id: number) {
  void closeProductWindow(productWindows, { folder: entry.folder }, windowClosedReactions);
  void stopChat(entry);
  if (lastFocused === id) lastFocused = null;
  updateBadge();
}

// --- The chat panel and the app bridge -----------------------------------------------------------

/** Where Claude Code keeps its files: the session store and the registry of running sessions. */
const CLAUDE_HOME = () => process.env.LATHE_CLAUDE_HOME ?? path.join(os.homedir(), '.claude');
/** How often, at most, a chat's changes are sent to its page while Claude writes. */
const CHAT_FRAME_MS = 33;
/** How long the bridge waits for a window's page to answer. */
const PAGE_ANSWER_MS = 5000;

let bridge: Promise<Bridge> | null = null;
/** The channel of each of the app bridge's questions: one per query or command it asks the page. */
const ASK_CHANNELS = { focus: 'lathe:ask-focus', open: 'lathe:ask-open' } as const;
type AskChannel = (typeof ASK_CHANNELS)[keyof typeof ASK_CHANNELS];
/** The bridge's questions waiting for a page's answer, each with the window and the channel asked on. */
const pageAnswers = new Map<string, { entry: OpenWindow; channel: AskChannel; resolve: (answer: unknown) => void }>();

/** Asks a window's page on a question's own channel (the preload's onAppRequest) and waits for its answer; null when it does not answer. */
function askPage(entry: OpenWindow, channel: AskChannel, request: { open?: OpenRequest }): Promise<unknown> {
  if (entry.win.isDestroyed()) return Promise.resolve(null);
  const id = randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pageAnswers.delete(id);
      resolve(null);
    }, PAGE_ANSWER_MS);
    pageAnswers.set(id, {
      entry,
      channel,
      resolve: (answer) => {
        clearTimeout(timer);
        pageAnswers.delete(id);
        resolve(answer);
      },
    });
    entry.win.webContents.send(channel, { id, ...request });
  });
}

const entryByKey = (key: string) => [...openWindows().values()].find((e) => e.key === key && !e.win.isDestroyed());

function appBridge(): Promise<Bridge> {
  bridge ??= startBridge({
    focus: async (key) => {
      const entry = entryByKey(key);
      if (!entry) return null;
      return (await askPage(entry, ASK_CHANNELS.focus, {})) ?? { connected: true, page: null };
    },
    open: async (key, request) => {
      const entry = entryByKey(key);
      if (!entry) return null;
      const answer = (await askPage(entry, ASK_CHANNELS.open, { open: request })) as OpenAnswer | null;
      if (answer && typeof answer.ok === 'boolean' && typeof answer.message === 'string') {
        if (answer.ok) entry.win.focus();
        return { ok: answer.ok, message: answer.message };
      }
      return { ok: false, message: 'The window did not answer.' };
    },
  });
  return bridge;
}

/** Sends the chat's changes to its page, at most once a frame. */
function chatChanged(entry: OpenWindow) {
  if (entry.chatTimer) return;
  entry.chatTimer = setTimeout(() => {
    entry.chatTimer = undefined;
    if (!entry.chat || entry.win.isDestroyed()) return;
    const state = entry.chat.state;
    entry.win.webContents.send('lathe:chat', chatPatch(entry.chatSent, state));
    entry.chatSent = state;
  }, CHAT_FRAME_MS);
}

function stopChat(entry: OpenWindow): Promise<void> {
  clearTimeout(entry.chatTimer);
  const chat = entry.chat;
  if (!chat) return Promise.resolve();
  const stop = chat.close();
  chatStops.add(stop);
  void stop.finally(() => chatStops.delete(stop));
  return stop;
}

const ourClaudes = () => new Set([...openWindows().values()].map((e) => e.chat?.pid).filter((pid): pid is number => typeof pid === 'number'));

/** The `claude` the chat runs, and the folder's saved sessions, for the panel's picker. */
/** Get the window's chat (LA-PLT-QRY10): the whole chat as one patch, for a page that (re)loads; the next patches follow it. */
function wholeChat(entry: OpenWindow) {
  entry.chatSent = entry.chat?.state ?? null;
  return entry.chat ? chatPatch(null, entry.chat.state) : null;
}

function chatSessions(entry: OpenWindow) {
  const settings = shellSettings.load();
  const claude = findClaude(settings.claudePath, os.homedir(), process.env.PATH);
  const home = CLAUDE_HOME();
  const running = runningSessions(path.join(home, 'sessions'), processAlive, ourClaudes());
  const current = entry.chat?.state.sessionId ?? null;
  const sessions = listSessions(path.join(home, 'projects'), entry.folder, running).map((s) => (s.id === current ? { ...s, openElsewhere: null } : s));
  return { claude, configured: !!settings.claudePath, current, sessions };
}

/** Opens a session in the window's chat: a new one, a saved one resumed, or a fork of one. */
async function openChat(entry: OpenWindow, input: unknown): Promise<boolean> {
  if (!input || typeof input !== 'object') return false;
  const { mode, id } = input as { mode?: unknown; id?: unknown };
  if (mode !== 'new' && mode !== 'resume' && mode !== 'fork') return false;
  const claude = findClaude(shellSettings.load().claudePath, os.homedir(), process.env.PATH);
  if (!claude) return false;
  let history: ReturnType<typeof transcriptItems> = [];
  if (mode !== 'new') {
    const file = typeof id === 'string' ? transcriptFile(path.join(CLAUDE_HOME(), 'projects'), entry.folder, id) : null;
    if (!file) return false;
    history = transcriptItems(readFileSync(file, 'utf8').split('\n'));
  }
  const env: NodeJS.ProcessEnv = { ...process.env, ...(await appBridge()).envFor(entry.key) };
  // The CLI's own directory, and the usual ones, on the PATH: an app started from the Finder has a short one.
  env.PATH = [path.dirname(claude), env.PATH, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean).join(path.delimiter);
  // Started from inside a Claude Code session (in development), the CLI would think it is nested.
  delete env.CLAUDECODE;
  if (entry.win.isDestroyed()) return false;
  // Each session gets a CLI of its own; the last one's ends first.
  await stopChat(entry);
  const chat = new ChatSession({ command: claude, cwd: entry.folder, env, onChange: () => chatChanged(entry) });
  entry.chat = chat;
  entry.chatSent = null;
  chat.open(mode === 'new' ? {} : { resume: id as string, fork: mode === 'fork' }, history);
  return true;
}

// --- Record actions, the Dock and About ----------------------------------------------------------

/** The Code editor integration (LA-INT03): opens a data file in the editor the Shell settings name. */
function openInEditor(file: string) {
  const settings = shellSettings.load();
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

/** The File manager integration (LA-INT02): reveals a data file in its folder, and puts a record's ID on the clipboard. */
const fileManager = {
  reveal: (file: string) => shell.showItemInFolder(file),
  copy: (text: string) => clipboard.writeText(text),
};

/** A record's native menu, over its window: each item runs that record action's own command. */
function popupRecordMenu(window: OpenWindow, id: string, file: string | null) {
  const input = { folder: window.folder, request: { id } };
  const actions = {
    openInNewTab: () => sendCommandId(window.win, 'openRecordInNewTab', []),
    reveal: () => revealRecordDataFile(productWindows, input, fileManager.reveal),
    openInEditor: () => openRecordDataFile(productWindows, input, openInEditor),
    copyId: () => copyRecordId(productWindows, input, fileManager.copy),
  };
  Menu.buildFromTemplate(recordMenuTemplate(id, !!file, editorName(shellSettings.load()), actions, process.platform)).popup({ window: window.win });
}

function updateBadge() {
  if (!MAC || !app.dock) return;
  const counts = new Map([...openWindows().values()].filter((e) => !e.win.isDestroyed()).map((e) => [e.win.id, e.errors]));
  const focused = BrowserWindow.getFocusedWindow();
  app.dock.setBadge(badgeFor(counts, focused && counts.has(focused.id) ? focused.id : null, lastFocused));
}

/** The app's own copy of Lathe's serve(): packed inside the app, or this repo's lathe/dist. */
const bundledServe = () => serveModulePath(REPO_ROOT, app.isPackaged ? { resourcesPath: process.resourcesPath } : null);

function showAbout() {
  if (about && !about.win.isDestroyed()) {
    about.win.show();
    about.win.focus();
    return;
  }
  const colors = startChrome(productWindows.load().chrome, dark());
  const front = focusedProductWindow();
  const product = [...openWindows().values()].find((e) => e.win === front);
  const lathe = product ? appServers.load().running.get(product.folder)?.lathe : undefined;
  const versions = { app: app.getVersion(), engine: packageVersion(bundledServe()), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node };
  const model = aboutModel(versions, colors, lathe ? { lathe } : null);
  const win = new BrowserWindow({
    width: 300,
    height: 350,
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
  // Its links open in the system browser, only those it shows (LA-INT61).
  win.webContents.setWindowOpenHandler(({ url }) => {
    const link = aboutLink(url, model);
    if (link) void shell.openExternal(link);
    return { action: 'deny' };
  });
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
  const last = recentList().find((item) => checkFolder(item.folder).ok);
  if (last) return openFolder(last.folder);
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
    const win = focusedProductWindow() ?? [...openWindows().values()][0]?.win;
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
    if (openWindows().size === 0) void openOnLaunch();
  });
  // Quitting waits until every window's server has stopped, so no database work outlives the process, and then
  // quits again; a server that hangs is given up on after QUIT_TIMEOUT (LA-PLT-UC11-R07).
  let quit: 'running' | 'stopping' | 'stopped' = 'running';
  app.on('before-quit', (event) => {
    if (quit === 'stopped') return;
    event.preventDefault();
    if (quit === 'stopping') return;
    quit = 'stopping';
    // Quitting stops each window's server as closing it would (LA-PLT-PO02), and its chat.
    for (const entry of openWindows().values()) {
      void stopAppServer(appServers, { folder: entry.folder }, log);
      void stopChat(entry);
    }
    if (bridge) void bridge.then((b) => b.close());
    void settleWithin([...appServers.load().stopping, ...chatStops], QUIT_TIMEOUT).then((all) => {
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

  // The page's theme colors for its window's chrome (the preload's setChrome): Set a window's chrome.
  ipcMain.on('lathe:set-chrome', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) setWindowChrome(productWindows, { folder: entry.folder, chrome: input, dark: dark(), platform: process.platform });
  });
  // Report a window's error count, for the Dock badge.
  ipcMain.on('lathe:error-count', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry && reportErrorCount(productWindows, { folder: entry.folder, count: input })) updateBadge();
  });
  // The record actions, each on its own channel, by record ID only (LA-PAT-SHELL-ACTIONS-R01).
  ipcMain.on('lathe:reveal-record', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) revealRecordDataFile(productWindows, { folder: entry.folder, request: input }, fileManager.reveal);
  });
  ipcMain.on('lathe:open-record-in-editor', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) openRecordDataFile(productWindows, { folder: entry.folder, request: input }, openInEditor);
  });
  ipcMain.on('lathe:copy-record-id', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) copyRecordId(productWindows, { folder: entry.folder, request: input }, fileManager.copy);
  });
  ipcMain.on('lathe:show-record-menu', (event, input: unknown) => {
    const entry = fromPage(event);
    if (entry) showRecordMenu(productWindows, { folder: entry.folder, request: input }, popupRecordMenu);
  });
  // The chat panel (the preload's chat): each call from a product window's own page, about that window's chat.
  const fromPageCall = (event: Electron.IpcMainInvokeEvent) => {
    const entry = entryOf(event.sender);
    return entry && event.senderFrame === entry.win.webContents.mainFrame ? entry : undefined;
  };
  ipcMain.handle('lathe:chat-sessions', (event) => {
    const entry = fromPageCall(event);
    return entry ? chatSessions(entry) : null;
  });
  ipcMain.handle('lathe:chat-open', (event, input: unknown) => {
    const entry = fromPageCall(event);
    return entry ? openChat(entry, input) : false;
  });
  ipcMain.handle('lathe:chat-send', (event, text: unknown) => {
    const entry = fromPageCall(event);
    return !!entry?.chat && typeof text === 'string' && entry.chat.send(text.slice(0, 100_000));
  });
  ipcMain.handle('lathe:chat-answer', (event, input: unknown) => {
    const entry = fromPageCall(event);
    const { id, allow } = (input ?? {}) as { id?: unknown; allow?: unknown };
    return !!entry?.chat && typeof id === 'string' && typeof allow === 'boolean' && entry.chat.answer(id, allow);
  });
  ipcMain.handle('lathe:chat-stop', (event) => {
    const entry = fromPageCall(event);
    return !!entry?.chat && entry.chat.stop();
  });
  // A page that (re)loads asks for the whole chat.
  ipcMain.handle('lathe:chat-state', (event) => {
    const entry = fromPageCall(event);
    return entry ? wholeChat(entry) : null;
  });
  // The page's answer to the app bridge's question (askPage), on the question's own channel.
  const answered = (channel: AskChannel) => (event: Electron.IpcMainEvent, input: unknown) => {
    const entry = fromPage(event);
    if (!entry || !input || typeof input !== 'object') return;
    const { id, answer } = input as { id?: unknown; answer?: unknown };
    const waiting = typeof id === 'string' ? pageAnswers.get(id) : undefined;
    if (waiting?.entry === entry && waiting.channel === channel) waiting.resolve(answer ?? null);
  };
  ipcMain.on('lathe:ask-focus', answered(ASK_CHANNELS.focus));
  ipcMain.on('lathe:ask-open', answered(ASK_CHANNELS.open));
  // The error page's buttons, each on its command's own channel, run only when that page shows it.
  const fromErrorPage = (event: Electron.IpcMainEvent, input: unknown, action: LocalAction) => {
    const entry = [...openWindows().values()].find((e) => e.overlay?.view.webContents === event.sender);
    return entry?.overlay && input === action && parseLocalAction(input, entry.overlay.model.actions) === action ? entry : undefined;
  };
  ipcMain.on('lathe:retry-app-server', (event, input: unknown) => {
    const entry = fromErrorPage(event, input, 'retry');
    if (entry) void retry(entry);
  });
  ipcMain.on('lathe:open-product-folder', (event, input: unknown) => {
    if (fromErrorPage(event, input, 'open-another')) void chooseFolder();
  });
  ipcMain.on('lathe:reveal-product-folder', (event, input: unknown) => {
    const entry = fromErrorPage(event, input, 'reveal');
    if (entry) revealProductFolder(productWindows, { folder: entry.folder }, fileManager.reveal);
  });

  void app.whenReady().then(async () => {
    // The app needs no camera, location or notifications; it may copy text.
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    setDockIcon();
    if (MAC) app.dock?.setMenu(Menu.buildFromTemplate(dockMenuTemplate({ newWindow: () => void chooseFolder() })));
    app.setAboutPanelOptions({ applicationName: 'Lathe', applicationVersion: app.getVersion() });
    refreshMenu();
    await openOnLaunch();
  });
}
