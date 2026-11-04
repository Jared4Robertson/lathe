import type { AppRequest, ChatBridge, ChatPatch, SignInState, VoiceBridge, VoiceEvent } from '../chat/types.ts';

/** @public Read by the desktop preload (through its 'lathe-desktop-bridge' path), which knip in app/ cannot see. */
export type { AppRequest, ChatPatch, SignInState, VoiceEvent };

// The desktop app's bridge: the one description of window.latheDesktop. The page reads it (desktopBridge in
// desktopChrome.ts); the preload (desktop/src/preload.cts, which reads it as 'lathe-desktop-bridge') builds the object and checks it against this, so a
// member added or changed on one side fails the typecheck on the other. Types only: it carries no code.

/** The desktop app's bridge (desktop/src/preload.cts exposes it as window.latheDesktop, ending in `satisfies LatheDesktop`): every member is there. */
export interface LatheDesktop {
  isDesktop: boolean;
  /** The operating system: "darwin", "win32" or "linux". */
  platform: string;
  /** Subscribes to native menu choices, each a command ID; returns the unsubscribe. */
  onCommand: (listener: (id: string) => void) => () => void;
  /** Sends the theme's shell and ink for the window's chrome. */
  setChrome: (chrome: { background: string; foreground: string }) => void;
  /** Subscribes to the window entering and leaving full screen; called at once with the current state. */
  onFullScreen: (listener: (fullScreen: boolean) => void) => () => void;
  /** Sends each command's keys as the person bound them, by command ID, for the native menu's key labels (LA-V66-R03). */
  setMenuKeys: (keys: Record<string, string[]>) => void;
  /** Sets the Dock badge to the product's number of check errors (LA-V71-R03). */
  setErrorCount: (count: number) => void;
  /** The record actions (LA-PAT-RECORD-DATA-FILE-R01): reveal its data file, open it in the editor, copy its ID, or a native menu of the three. */
  revealRecord: (id: string) => void;
  openRecordInEditor: (id: string) => void;
  copyRecordId: (id: string) => void;
  showRecordMenu: (id: string) => void;
  /** The chat panel's Claude Code (LA-PLT-UC19). */
  chat: ChatBridge;
  /** The chat's dictation (LA-PLT-UC20-R01): on-device speech recognition, where the Mac has it. */
  voice: VoiceBridge;
  /** Answers the app bridge's questions for Lathe's MCP tools: what the Reader is looking at, and opening a record. */
  onAppRequest: (handler: (request: AppRequest) => unknown) => () => void;
}

declare global {
  interface Window {
    /** Set by the desktop app's preload; absent in a browser. */
    latheDesktop?: LatheDesktop;
  }
}
