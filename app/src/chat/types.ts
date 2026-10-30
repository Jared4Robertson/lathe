// The chat panel's protocol with the desktop shell (LA-PLT-UC19), as desktop/src/chat.ts,
// claudeSessions.ts and bridge.ts send it; the shell checks what the page sends, and the page reads
// what the shell sends as these types (window.latheDesktop.chat, typed in shell/commands.tsx).

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  /** A tool call: `label` names it for the row ("lathe add"), `summary` is its input's one line. */
  | { kind: 'tool'; id: string; name: string; label: string; summary: string; input: string; result: string | null; status: 'running' | 'done' | 'error' }
  /** A permission prompt: `always` is allowed for the rest of the chat; `refused` is View only refusing a tool that may change things, `reason` saying so. */
  | { kind: 'permission'; id: string; tool: string; label: string; summary: string; input: string; reason: string | null; answer: 'pending' | 'allowed' | 'always' | 'denied' | 'refused' | 'canceled' }
  | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

/** idle: waiting for the Owner; running: a turn is under way; closed: no process (the next message starts one). */
export type ChatStatus = 'idle' | 'running' | 'stopping' | 'closed';

/** The chat's permission modes, in the order the control lists them (desktop/src/chat.ts). */
export const CHAT_MODES = ['ask', 'accept-reads', 'auto', 'bypass', 'view-only'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** The Owner's answer to a permission prompt. */
export type PromptAnswer = 'once' | 'always' | 'deny';

/** The Lathe tools the session has: being counted, how many, or why they did not load; and the Lathe version they come from. */
export type LatheTools =
  | { status: 'counting'; version: string | null }
  | { status: 'loaded'; version: string | null; count: number }
  | { status: 'failed'; version: string | null; problem: string };

export interface ChatPatch {
  reset: boolean;
  sessionId: string | null;
  status: ChatStatus;
  /** The permission mode the session runs in. */
  mode: ChatMode;
  lathe: LatheTools;
  items: { at: number; item: ChatItem }[];
}

export interface SessionSummary {
  id: string;
  title: string;
  updated: number;
  openElsewhere: 'running' | 'recent' | null;
}

export interface ChatSessions {
  /** The `claude` the chat runs, or null when Lathe could not find it. */
  claude: string | null;
  /** Whether settings.json names it. */
  configured: boolean;
  /** Whether it is signed in, as `claude auth status` says; null when it cannot tell. */
  signedIn: boolean | null;
  /** The mode the folder's next chat starts in (its last chat's). */
  mode: ChatMode;
  /** The session the window's chat has open. */
  current: string | null;
  sessions: SessionSummary[];
}

export type OpenChoice = { mode: 'new' } | { mode: 'resume' | 'fork'; id: string };

/** What the app bridge asks the page, for Lathe's MCP tools (desktop/src/bridge.ts). */
export type AppRequest = { kind: 'focus' } | { kind: 'open'; open: { id: string; stage: 'graph' | 'erd' | 'trace' | null } };

export interface ChatBridge {
  sessions: () => Promise<ChatSessions | null>;
  open: (choice: OpenChoice) => Promise<boolean>;
  /** Sends a message, with what the Owner is looking at as context (null: none). */
  send: (text: string, focus: string | null) => Promise<boolean>;
  answer: (id: string, answer: PromptAnswer) => Promise<boolean>;
  stop: () => Promise<boolean>;
  /** Chooses the permission mode: the open chat starts again on its session, and the folder keeps it; false when refused. */
  setMode: (mode: ChatMode) => Promise<boolean>;
  /** Subscribes to the chat's patches; the first is the whole chat, when the window has one. */
  onPatch: (listener: (patch: ChatPatch) => void) => () => void;
}
