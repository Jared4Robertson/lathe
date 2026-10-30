// The chat panel's protocol with the desktop shell (LA-PLT-UC19), as desktop/src/chat.ts,
// claudeSessions.ts and bridge.ts send it; the shell checks what the page sends, and the page reads
// what the shell sends as these types (window.latheDesktop.chat, typed in shell/commands.tsx).

export type ChatItem =
  /** `images` counts the pictures sent with it. */
  | { kind: 'user'; id: string; text: string; images: number }
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

/** The models the picker offers, by the alias Claude Code takes; null leaves the choice to Claude Code. */
export const CHAT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type ChatModel = (typeof CHAT_MODELS)[number];
export const CHAT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ChatEffort = (typeof CHAT_EFFORTS)[number];
/** The model and effort a session runs with. */
export interface ModelChoice { model: ChatModel | null; effort: ChatEffort | null }

/** A message typed while Claude works, waiting its turn. */
export interface QueuedMessage { id: string; text: string; images: number }

/** An image sent with a message: base64, with its type. */
export interface ChatImage { mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string }

/** A skill or slash command the "/" list shows. */
export interface ChatSkill { name: string; description: string; kind: 'skill' | 'command' }

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
  choice: ModelChoice;
  lathe: LatheTools;
  queue: QueuedMessage[];
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
  /** Sends a message, with what the Owner is looking at as context (null: none) and any images; while Claude works it is queued. */
  send: (text: string, focus: string | null, images: ChatImage[]) => Promise<boolean>;
  /** Chooses the model and effort: the open chat starts again on its session; false when refused. */
  setModel: (model: ChatModel | null, effort: ChatEffort | null) => Promise<boolean>;
  /** Takes a queued message out of the queue. */
  unqueue: (id: string) => Promise<boolean>;
  /** The skills and slash commands Claude Code would find for this folder. */
  skills: () => Promise<ChatSkill[]>;
  /** The stage as drawn (a rectangle of the window, in CSS pixels), as base64 PNG; null when it cannot be captured. */
  captureStage: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
  answer: (id: string, answer: PromptAnswer) => Promise<boolean>;
  stop: () => Promise<boolean>;
  /** Chooses the permission mode: the open chat starts again on its session, and the folder keeps it; false when refused. */
  setMode: (mode: ChatMode) => Promise<boolean>;
  /** Subscribes to the chat's patches; the first is the whole chat, when the window has one. */
  onPatch: (listener: (patch: ChatPatch) => void) => () => void;
}

// ---------- Voice (LA-PLT-UC20), as desktop/src/voice.ts sends it ----------

/** Whether the window can dictate: on-device recognition there (macOS 26 or later), the microphone's permission, and end-of-turn detection. */
export interface VoiceSupport {
  available: boolean;
  /** Why it cannot, said to the Owner; null when it can. */
  reason: string | null;
  microphone: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';
  /** Whether the helper reads the voice's pitch for Quick mode; without it, a fixed pause sends. */
  endOfTurn: boolean;
}

/** A word heard, with its times in seconds since listening began. */
export interface VoiceWord { text: string; start: number; end: number }

/** What the shell hears, and whether it listens. Times are seconds since listening began; each start begins them again. */
export type VoiceEvent =
  /** Listening began, or stopped: asked to, the window went behind another (it listens only in front), the helper ended, or the microphone was refused or failed. */
  | { type: 'listening'; on: boolean; why: 'started' | 'stopped' | 'background' | 'ended' | 'denied' | 'failed'; message: string | null }
  /** The on-device speech model is being installed (the first time only). */
  | { type: 'preparing' }
  /** The words so far of the utterance being heard; the recognizer may still change them. */
  | { type: 'volatile'; text: string }
  /** An utterance's words, settled, with their times. */
  | { type: 'final'; words: VoiceWord[] }
  /** The voice started. */
  | { type: 'speech'; at: number }
  /** The voice stopped, with how its pitch moved at the end. */
  | { type: 'silence'; at: number; pitch: 'falling' | 'rising' | 'level' | null };

export interface VoiceBridge {
  support: () => Promise<VoiceSupport>;
  /** Asks the shell to listen, or to stop; it asks macOS for the microphone the first time, and listens only while the window is in front. */
  listen: (on: boolean) => Promise<'listening' | 'background' | 'denied' | 'unavailable' | 'stopped'>;
  onEvent: (listener: (event: VoiceEvent) => void) => () => void;
}
