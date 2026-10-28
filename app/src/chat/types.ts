// The chat panel's protocol with the desktop shell (LA-PLT-UC19), as desktop/src/chat.ts,
// claudeSessions.ts and bridge.ts send it; the shell checks what the page sends, and the page reads
// what the shell sends as these types (window.latheDesktop.chat, typed in shell/commands.tsx).

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  /** A tool call: `label` names it for the row ("lathe add"), `summary` is its input's one line. */
  | { kind: 'tool'; id: string; name: string; label: string; summary: string; input: string; result: string | null; status: 'running' | 'done' | 'error' }
  | { kind: 'permission'; id: string; tool: string; label: string; summary: string; input: string; reason: string | null; answer: 'pending' | 'allowed' | 'denied' | 'canceled' }
  | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

/** idle: waiting for the Owner; running: a turn is under way; closed: no process (the next message starts one). */
export type ChatStatus = 'idle' | 'running' | 'stopping' | 'closed';

export interface ChatPatch {
  reset: boolean;
  sessionId: string | null;
  status: ChatStatus;
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
  send: (text: string) => Promise<boolean>;
  answer: (id: string, allow: boolean) => Promise<boolean>;
  stop: () => Promise<boolean>;
  /** Subscribes to the chat's patches; the first is the whole chat, when the window has one. */
  onPatch: (listener: (patch: ChatPatch) => void) => () => void;
}
