// Product window (LA-PLT-A6): the desktop windows open on product folders, one per folder, while the shell runs;
// each folder's window place (size and position), remembered between launches; the chrome colors the pages
// last sent, so a new window opens in the theme's shell color (LA-V68-R01); and each folder's chat permission
// mode (LA-PLT-UC19-R09), so a new chat there starts in the mode its last one had. The places are pure functions
// over a plain object, so they are unit-tested.
import type { BrowserWindow, WebContentsView } from 'electron';
import path from 'node:path';
import { DEFAULT_MODE, isChatMode, type ChatMode, type ChatState } from '../chat.ts';
import type { ChatSession } from '../chatSession.ts';
import type { Chrome, SavedChrome } from '../chrome.ts';
import type { LaunchModel } from '../launch.ts';
import type { MenuKeys } from '../menu.ts';
import type { DataFiles } from '../records.ts';
import type { VoiceListener } from '../voice.ts';

/** A window open on a product folder. Its server is the App server's (app-server/). */
export interface OpenWindow {
  folder: string;
  product: string;
  win: BrowserWindow;
  chrome?: Chrome;
  /** The launch view or error page over the app's page, while it shows. */
  overlay?: { view: WebContentsView; model: LaunchModel };
  /** The text the launch view showed, for the smoke run. */
  launchSeen?: string;
  /** The product's check errors, as the page last reported them. */
  errors: number;
  /** The keys the person bound in the page, as it last reported them, which the menu shows while the window has focus. */
  menuKeys?: MenuKeys;
  dataFiles: DataFiles | null;
  /** Bumped on each launch, so an old watch stops. */
  launchRun: number;
  /** The window's name on the app bridge. */
  key: string;
  /** The chat panel's Claude Code, once a session is opened. */
  chat?: ChatSession;
  /** The chat state the page last got, and the timer that sends the next patch. */
  chatSent: ChatState | null;
  chatTimer?: NodeJS.Timeout;
  /** The window's listening for the chat's voice, once the page has asked (voice.ts). */
  voice?: VoiceListener;
}

/** The whole aggregate: the open windows by folder, the saved places by folder, the saved chrome, and the chat modes by folder. */
export interface ProductWindows {
  open: ReadonlyMap<string, OpenWindow>;
  places: WindowStates;
  chrome: SavedChrome;
  modes: ChatModes;
}

/** Each folder's chat mode, by full path; a folder not listed starts in the default mode, which is never kept. */
export type ChatModes = Readonly<Record<string, ChatMode>>;

/** Reads the saved chat modes, keeping only full paths with a mode Lathe knows, other than the default. */
export function parseChatModes(raw: unknown): ChatModes {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const modes: Record<string, ChatMode> = {};
  for (const [folder, mode] of Object.entries(raw as Record<string, unknown>)) {
    if (path.isAbsolute(folder) && isChatMode(mode) && mode !== DEFAULT_MODE) modes[path.resolve(folder)] = mode;
  }
  return modes;
}

/** The modes with this folder's chat mode chosen. */
export function chooseMode(modes: ChatModes, folder: string, mode: ChatMode): ChatModes {
  const full = path.resolve(folder);
  const { [full]: _was, ...rest } = modes;
  return mode === DEFAULT_MODE ? rest : { ...rest, [full]: mode };
}

/** The mode a folder's chat starts in: its last chat's, else the default. */
export const startingMode = (modes: ChatModes, folder: string): ChatMode => modes[path.resolve(folder)] ?? DEFAULT_MODE;

export interface Bounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface SavedWindow extends Bounds {
  maximized?: boolean;
  fullScreen?: boolean;
}

/** Saved windows by folder. */
export type WindowStates = Record<string, SavedWindow>;

export const DEFAULT_SIZE = { width: 1280, height: 820 } as const;
export const MIN_SIZE = { width: 640, height: 420 } as const;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads saved states, dropping anything that is not a usable window. */
export function parseWindowStates(raw: unknown): WindowStates {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const states: WindowStates = {};
  for (const [folder, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<SavedWindow> | null;
    if (!v || !isNumber(v.width) || !isNumber(v.height)) continue;
    states[folder] = {
      width: Math.max(MIN_SIZE.width, Math.round(v.width)),
      height: Math.max(MIN_SIZE.height, Math.round(v.height)),
      ...(isNumber(v.x) && isNumber(v.y) ? { x: Math.round(v.x), y: Math.round(v.y) } : {}),
      ...(v.maximized ? { maximized: true } : {}),
      ...(v.fullScreen ? { fullScreen: true } : {}),
    };
  }
  return states;
}

/** The states with this folder's window saved. A maximized or full-screen window keeps its normal bounds. */
export function saveWindow(states: WindowStates, folder: string, window: SavedWindow): WindowStates {
  return { ...states, [path.resolve(folder)]: parseWindowStates({ w: window }).w ?? { ...DEFAULT_SIZE } };
}

interface Rect { x: number; y: number; width: number; height: number }

/** How much of `a` lies inside `b`, in square pixels. */
function overlap(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Where a folder's window opens: its saved bounds when enough of the window (its top 40 px by 160 px,
 * where it is dragged) is on a display now, its saved size centered otherwise, or the default size.
 * `displays` are the work areas of the connected displays.
 */
export function windowFor(states: WindowStates, folder: string, displays: Rect[]): SavedWindow {
  const saved = states[path.resolve(folder)];
  if (!saved) return { ...DEFAULT_SIZE };
  const largest = displays.reduce<Rect | undefined>((best, d) => (!best || d.width * d.height > best.width * best.height ? d : best), undefined);
  const fit = (size: number, room: number | undefined) => (room ? Math.min(size, room) : size);
  const width = fit(saved.width, largest?.width);
  const height = fit(saved.height, largest?.height);
  const flags = { ...(saved.maximized ? { maximized: true } : {}), ...(saved.fullScreen ? { fullScreen: true } : {}) };
  if (saved.x !== undefined && saved.y !== undefined) {
    const grip = { x: saved.x, y: saved.y, width: Math.min(160, width), height: 40 };
    if (displays.some((d) => overlap(grip, d) >= grip.width * grip.height * 0.5)) return { x: saved.x, y: saved.y, width, height, ...flags };
  }
  return { width, height, ...flags };
}
