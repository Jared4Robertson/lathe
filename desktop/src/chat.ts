// The chat panel's conversation, apart from Electron and the process (LA-PLT-UC19): the arguments the
// user's own `claude` CLI runs with, the lines the panel writes to it, and how the lines it prints
// become the chat's items. The CLI runs headless with structured input and output
// (`-p --input-format stream-json --output-format stream-json`); it asks the panel for each tool
// permission with a `can_use_tool` control request (`--permission-prompt-tool stdio`), which the
// panel answers with a `control_response`; Stop sends an `interrupt` control request.
//
// Every session loads the Lathe plugin of the Lathe the window runs (`--plugin-dir`, LA-PLT-UC19-R08;
// chatLathe.ts picks it), which takes the place of an installed plugin of the same name, so the tools
// are there, once, whatever the Owner has installed, and is told how to work beside the window
// (`--append-system-prompt`, LA-PLT-UC19-R12): each message may carry what the Owner is looking at
// (a <lathe-focus> block), and app_focus and app_open answer anything else about the window.
//
// The chat's permission mode (LA-PLT-UC19-R09) is one of five, each mapped to the CLI's own flags and,
// where the CLI has none, to the panel's answer to its permission prompts (`decide`):
//   Ask           `--permission-mode default` and ask rules (`--settings`) for every tool, so even reads ask;
//   Accept reads  the default: `--permission-mode default --allowedTools Read,Grep,Glob` and Lathe's check,
//                 app_focus and app_open; the panel allows Lathe's other reads (its tools marked
//                 readOnlyHint, counted by chatLathe.ts) and asks for everything else;
//   Auto          `--permission-mode auto`: Claude Code's own classifier decides; what it asks, the panel asks;
//   Bypass        `--permission-mode bypassPermissions`: nothing asks;
//   View only     Accept reads with no writes: Lathe's server lists only its reads (LATHE_VIEW_ONLY=1),
//                 Claude Code's tools that write files or run code are `--disallowedTools`, Claude is told
//                 why, and a prompt for a tool that may change things is refused, saying the chat is View only.
// A tool the Owner allows always is allowed by the panel for the rest of the chat (LA-PLT-UC19-R11).
//
// The items are what the panel draws: the Owner's messages, Claude's text (streamed as it is
// written), each tool call with its input and result, each permission prompt with its answer, and
// notices. The page gets them as patches (chatPatch); the types are repeated in the app's
// app/src/chat/types.ts, as the preload's are.

export type ChatItem =
  | { kind: 'user'; id: string; text: string; images: number }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; label: string; summary: string; input: string; result: string | null; status: 'running' | 'done' | 'error' }
  | { kind: 'permission'; id: string; tool: string; label: string; summary: string; input: string; reason: string | null; answer: PromptAnswer }
  | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

/** A prompt's answer: allowed once, allowed always in this chat, denied by the Owner, refused by View only, or withdrawn. */
export type PromptAnswer = 'pending' | 'allowed' | 'always' | 'denied' | 'refused' | 'canceled';

/** The chat's permission modes (LA-PLT-UC19-R09), in the order the control lists them. */
export const CHAT_MODES = ['ask', 'accept-reads', 'auto', 'bypass', 'view-only'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];
/** The mode a folder's first chat starts in. */
export const DEFAULT_MODE: ChatMode = 'accept-reads';
export const isChatMode = (value: unknown): value is ChatMode => typeof value === 'string' && (CHAT_MODES as readonly string[]).includes(value);

/** idle: waiting for the Owner; running: a turn is under way; closed: no process (the next message starts one). */
export type ChatStatus = 'idle' | 'running' | 'stopping' | 'closed';

/** The Lathe tools the session has (LA-PLT-UC19-R10): being counted, how many, or why they did not load; and the Lathe version they come from. */
export type LatheTools =
  | { status: 'counting'; version: string | null }
  | { status: 'loaded'; version: string | null; count: number }
  | { status: 'failed'; version: string | null; problem: string };

/** The models the picker offers, by the short name `--model` takes; null is Claude Code's own default. */
export const CHAT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type ChatModel = (typeof CHAT_MODELS)[number];
export const isChatModel = (value: unknown): value is ChatModel => typeof value === 'string' && (CHAT_MODELS as readonly string[]).includes(value);

/** The effort levels the picker offers, as `--effort` takes them; null is Claude Code's own default. */
export const CHAT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ChatEffort = (typeof CHAT_EFFORTS)[number];
export const isChatEffort = (value: unknown): value is ChatEffort => typeof value === 'string' && (CHAT_EFFORTS as readonly string[]).includes(value);

/** The model and effort a session runs with (LA-PLT-UC19-R15); null leaves the choice to Claude Code. */
export interface ChatModelChoice { model: ChatModel | null; effort: ChatEffort | null }

/** A message typed while Claude works, waiting its turn (LA-PLT-UC19-R16). */
export interface QueuedMessage { id: string; text: string; images: number }

export interface ChatState {
  /** The Claude Code session the chat continues, once the CLI has named it. */
  sessionId: string | null;
  status: ChatStatus;
  /** The permission mode the session runs in. */
  mode: ChatMode;
  /** The model and effort the session runs with. */
  choice: ChatModelChoice;
  lathe: LatheTools;
  items: ChatItem[];
  /** The messages typed while Claude worked, sent in order as each turn ends. */
  queue: QueuedMessage[];
}

export const EMPTY_CHAT: ChatState = { sessionId: null, status: 'closed', mode: DEFAULT_MODE, choice: { model: null, effort: null }, lathe: { status: 'counting', version: null }, items: [], queue: [] };

/** What the page is sent: the state's head, and the items changed since the last patch, by position. */
export interface ChatPatch {
  reset: boolean;
  sessionId: string | null;
  status: ChatStatus;
  mode: ChatMode;
  choice: ChatModelChoice;
  lathe: LatheTools;
  queue: QueuedMessage[];
  /** Every item when reset; otherwise those new or changed, each with its position. */
  items: { at: number; item: ChatItem }[];
}

/** The patch from one state to the next: items are only appended or replaced, never removed (a new session resets). */
export function chatPatch(before: ChatState | null, after: ChatState): ChatPatch {
  const reset = !before || after.items.length < before.items.length || after.items.slice(0, before.items.length).some((item, i) => item.id !== before.items[i].id);
  const items = after.items.flatMap((item, at) => (reset || before?.items[at] !== item ? [{ at, item }] : []));
  return { reset, sessionId: after.sessionId, status: after.status, mode: after.mode, choice: after.choice, lathe: after.lathe, queue: after.queue, items };
}

// ---------- The CLI's arguments and input ----------

export interface StartOptions {
  /** The session to continue; none starts a new one. */
  resume?: string;
  /** Continue a copy of `resume` under a new session ID, leaving the original as it was. */
  fork?: boolean;
}

/** How every session of a window's chat runs: the Lathe plugin it loads, and its permission mode. */
export interface ChatSetup {
  /** The folder of the Lathe plugin the session loads (chatLathe.ts). */
  pluginDir: string;
  mode: ChatMode;
  /** The model and effort the Owner chose, if any (LA-PLT-UC19-R15). */
  choice?: ChatModelChoice;
}

/**
 * Claude Code's own tools that write files, run code or change anything beyond the conversation: none of them runs
 * in View only. Every built-in tool is either here or known to only read (the test holds the CLI's list to this).
 */
export const VIEW_ONLY_DISALLOWED = [
  'Bash', 'PowerShell', 'Monitor', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'EnterWorktree', 'ExitWorktree',
  'Workflow', 'CronCreate', 'CronDelete', 'Artifact', 'ArtifactComments', 'ArtifactData', 'DesignSync',
] as const;

/** What Claude is told in every session: how to work beside the window (LA-PLT-UC19-R12). */
export const CHAT_PROMPT =
  "You are working in the Lathe desktop app's chat, beside the window where the Owner reads this product's spec. " +
  'A message may begin with a <lathe-focus> block: what the Owner was looking at in the window as they wrote it (the product, the page, ' +
  'the stage, the focused record and the selection). Start from it; it needs no tool call. For anything else about the window, ask ' +
  "Lathe's app_focus tool what the Owner is looking at, and use app_open to show them a record: never search the code or the files to " +
  'find what the window shows.';

/** What Claude is told in View only, so it says why it cannot change anything. */
export const VIEW_ONLY_PROMPT =
  "This chat is View only: the Owner chose View only in the header of Lathe's chat. You may read the spec, the repo and the web, " +
  "but you must not change anything: Lathe's command tools and Claude Code's tools that write files or run commands are not available. " +
  "When asked to change something, say that the chat is View only and that the Owner can choose another mode in the chat's header to make the change.";

/** Claude Code's own tools that only read the folder, which Accept reads and View only allow without asking. */
const CLI_READS = ['Read', 'Grep', 'Glob'];
/** Lathe's tools allowed by name in Accept reads and View only; its queries are allowed by the panel, as their names come from the schema. */
const LATHE_NAMED_READS = ['check', 'app_focus', 'app_open'].map((name) => `mcp__plugin_lathe_lathe__${name}`);
/** Every tool Ask makes ask for, whatever the Owner's own settings allow (ask rules win over allow rules). */
const ASK_EVERYTHING = { permissions: { ask: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'mcp__plugin_lathe_lathe'] } };

/** The CLI's permission flags for a mode. */
function modeArgs(mode: ChatMode): string[] {
  switch (mode) {
    case 'ask':
      return ['--permission-mode', 'default', '--settings', JSON.stringify(ASK_EVERYTHING)];
    case 'accept-reads':
      return ['--permission-mode', 'default', '--allowedTools', [...CLI_READS, ...LATHE_NAMED_READS].join(',')];
    case 'auto':
      return ['--permission-mode', 'auto'];
    case 'bypass':
      return ['--permission-mode', 'bypassPermissions'];
    case 'view-only':
      return ['--permission-mode', 'default', '--allowedTools', [...CLI_READS, ...LATHE_NAMED_READS].join(','), '--disallowedTools', VIEW_ONLY_DISALLOWED.join(',')];
  }
}

/** The CLI's arguments: headless, structured input and output, partial messages, permission prompts to the panel, Lathe's plugin, how to work beside the window, and the mode's flags. */
export function claudeArgs({ resume, fork }: StartOptions, { pluginDir, mode, choice }: ChatSetup): string[] {
  const prompt = mode === 'view-only' ? `${CHAT_PROMPT}\n\n${VIEW_ONLY_PROMPT}` : CHAT_PROMPT;
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio', '--plugin-dir', pluginDir, '--append-system-prompt', prompt, ...modeArgs(mode)];
  if (choice?.model) args.push('--model', choice.model);
  if (choice?.effort) args.push('--effort', choice.effort);
  if (resume) args.push('--resume', resume);
  if (resume && fork) args.push('--fork-session');
  return args;
}

/** The environment variable that makes Lathe's MCP server list only its reads (lathe/src/cli/mcp.ts). */
const VIEW_ONLY_ENV = 'LATHE_VIEW_ONLY';

/** The CLI's environment: the window's, with View only passed on to Lathe's MCP server. */
export function claudeEnv(env: NodeJS.ProcessEnv, mode: ChatMode): NodeJS.ProcessEnv {
  const next = { ...env };
  if (mode === 'view-only') next[VIEW_ONLY_ENV] = '1';
  else delete next[VIEW_ONLY_ENV];
  return next;
}

/** Lathe's own MCP tools, as Claude Code names them when the plugin loads them. */
export const LATHE_TOOL_PREFIX = 'mcp__plugin_lathe_lathe__';
const LATHE_TOOL = /^mcp__plugin_lathe_lathe__/;

/** How the panel answers a permission prompt itself, by the chat's mode, before asking the Owner. */
export type Decision = { kind: 'allow' } | { kind: 'refuse'; why: string } | { kind: 'ask' };

/**
 * The panel's answer to a prompt for a tool: View only refuses what may change things; Bypass allows everything; a
 * tool allowed always in this chat is allowed; Accept reads and View only allow the reads (Lathe's read tools, by the
 * names `latheReads` holds, and Claude Code's own); everything else asks the Owner.
 */
export function decide(mode: ChatMode, tool: string, latheReads: ReadonlySet<string>, always: ReadonlySet<string>): Decision {
  if (mode === 'view-only') {
    const why = viewOnlyRefusal(tool);
    if (why) return { kind: 'refuse', why };
  }
  if (mode === 'bypass' || always.has(tool)) return { kind: 'allow' };
  const read = CLI_READS.includes(tool) || LATHE_NAMED_READS.includes(tool) || latheReads.has(tool);
  if ((mode === 'accept-reads' || mode === 'view-only') && read) return { kind: 'allow' };
  return { kind: 'ask' };
}

/**
 * Why View only refuses a permission prompt for this tool, or null when the tool only reads: one of Claude Code's own
 * writes, or another MCP server's tool, which may change things. Lathe's own tools are only its reads in View only.
 */
export function viewOnlyRefusal(tool: string): string | null {
  const writes = (VIEW_ONLY_DISALLOWED as readonly string[]).includes(tool) || (tool.startsWith('mcp__') && !LATHE_TOOL.test(tool));
  return writes ? `This chat is View only, so ${toolLabel(tool)} was refused: it may change things. Choose another mode in the chat's header to allow it.` : null;
}

/** The most a focus block may hold. */
const MAX_FOCUS = 4000;

/** The block that carries what the Owner is looking at with a message (LA-PLT-UC19-R12), as context before their own text. */
export const focusBlock = (focus: string) => `<lathe-focus>\n${focus.slice(0, MAX_FOCUS).replaceAll('</lathe-focus>', '')}\n</lathe-focus>`;

/**
 * The line that sends the Owner's message, as the Agent SDK writes it, with what they are looking at as a block of its
 * own before it. Slash commands go as text, alone; the CLI runs those it can headless.
 */
export function userLine(text: string, focus: string | null = null, images: readonly ChatImage[] = []): string {
  const context = focus && !text.trimStart().startsWith('/') ? [{ type: 'text', text: focusBlock(focus) }] : [];
  const pictures = images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } }));
  return JSON.stringify({ type: 'user', session_id: '', message: { role: 'user', content: [...context, ...pictures, { type: 'text', text }] }, parent_tool_use_id: null });
}

/** An image sent with a message (LA-PLT-UC19-R17): pasted, or the stage as it is drawn. */
export interface ChatImage { mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string }
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
/** The most images a message carries, and the most base64 characters of one (about 5 MB of picture). */
export const MAX_IMAGES = 6;
export const MAX_IMAGE_CHARS = 7_000_000;

/** The images the page sent, checked: base64 of a type the CLI takes, at most so many and so large; null when any is not. */
export function parseImages(input: unknown): ChatImage[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_IMAGES) return null;
  const out: ChatImage[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const { mediaType, data } = item as Record<string, unknown>;
    if (typeof mediaType !== 'string' || !IMAGE_TYPES.has(mediaType) || typeof data !== 'string' || data.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
    out.push({ mediaType: mediaType as ChatImage['mediaType'], data });
  }
  return out;
}

/** The line that answers a permission prompt: allow with the tool's input unchanged, or deny, saying why. */
export function permissionLine(requestId: string, allow: boolean, input: unknown, why = 'The Owner denied this in Lathe.'): string {
  const response = allow ? { behavior: 'allow', updatedInput: input ?? {} } : { behavior: 'deny', message: why };
  return JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response } });
}

/** The line that stops the turn under way. */
export const interruptLine = (requestId: string) => JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'interrupt' } });

// ---------- Tools as rows ----------

/** A tool's name as the row shows it: an MCP tool as its server and tool ("lathe add"), a built-in tool as it is. */
export function toolLabel(name: string): string {
  const mcp = /^mcp__(.+)__([^_].*)$/.exec(name);
  if (!mcp) return name;
  const server = mcp[1].split(/_+/).filter(Boolean).at(-1) ?? mcp[1];
  return `${server} ${mcp[2]}`;
}

const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'id', 'description', 'prompt', 'skill'];
const MAX_TEXT = 6000;
const clip = (text: string, max = MAX_TEXT) => (text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text);
const oneLine = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
};

/** The one line a tool row shows of its input: the command, the file, the pattern, the ID a Lathe command or query names, or its first text. */
export function toolSummary(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const fields = input as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) if (typeof fields[key] === 'string' && fields[key]) return oneLine(fields[key] as string);
  // A Lathe tool is one aggregate's command or query (lathe/src/cli/mcp.ts): its input names its record by `id`, above,
  // or by the record it sits under, such as `domain_id`.
  const entries = Object.entries(fields);
  const text = entries.find(([, v]) => typeof v === 'string');
  return text ? oneLine(String(text[1])) : '';
}

const pretty = (input: unknown) => clip(JSON.stringify(input ?? {}, null, 2));

/** A tool result's text: its text blocks, or the string itself. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return clip(content);
  if (!Array.isArray(content)) return '';
  return clip(content.map((b: { type?: string; text?: string }) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : b?.type === 'image' ? '[image]' : '')).filter(Boolean).join('\n'));
}

// ---------- The CLI's output ----------

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function upsert(items: ChatItem[], item: ChatItem): ChatItem[] {
  const at = items.findIndex((i) => i.id === item.id);
  if (at < 0) return [...items, item];
  const next = items.slice();
  next[at] = item;
  return next;
}

const update = <K extends ChatItem['kind']>(items: ChatItem[], id: string, kind: K, change: (item: Extract<ChatItem, { kind: K }>) => ChatItem): ChatItem[] => {
  const at = items.findIndex((i) => i.id === id && i.kind === kind);
  if (at < 0) return items;
  const next = items.slice();
  next[at] = change(items[at] as Extract<ChatItem, { kind: K }>);
  return next;
};

/** Every prompt still waiting is withdrawn (the turn stopped, or the process ended). */
export const withdrawPrompts = (items: ChatItem[]): ChatItem[] =>
  items.some((i) => i.kind === 'permission' && i.answer === 'pending') ? items.map((i) => (i.kind === 'permission' && i.answer === 'pending' ? { ...i, answer: 'canceled' } : i)) : items;

/** The panel's own bookkeeping while it reads the stream: the message being streamed. */
export interface StreamCursor { messageId: string | null; notices: number }
export const NEW_CURSOR: StreamCursor = { messageId: null, notices: 0 };

/** The tool calls and text blocks of one assistant message, as items. */
function assistantBlocks(items: ChatItem[], message: Json, streamed: boolean): ChatItem[] {
  const id = str(message.id) ?? 'message';
  const content = Array.isArray(message.content) ? message.content : [];
  let next = items;
  let textIndex = 0;
  for (const raw of content) {
    const block = asObject(raw);
    if (!block) continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      if (streamed) continue;
      // Unstreamed text: each block its own item, after the message's earlier ones.
      while (next.some((i) => i.id === `a:${id}:${textIndex}`)) textIndex++;
      next = upsert(next, { kind: 'assistant', id: `a:${id}:${textIndex}`, text: block.text, streaming: false });
    } else if (block.type === 'tool_use' && typeof block.id === 'string') {
      const name = str(block.name) ?? 'tool';
      const existing = next.find((i) => i.id === block.id);
      if (!existing) next = upsert(next, { kind: 'tool', id: block.id, name, label: toolLabel(name), summary: toolSummary(block.input), input: pretty(block.input), result: null, status: 'running' });
    }
  }
  // A streamed message's text is complete once the message is.
  return streamed ? next.map((i) => (i.kind === 'assistant' && i.streaming && i.id.startsWith(`a:${id}:`) ? { ...i, streaming: false } : i)) : next;
}

/** Tool results in a user message close their tool rows. */
function toolResults(items: ChatItem[], message: Json): ChatItem[] {
  const content = Array.isArray(message.content) ? message.content : [];
  let next = items;
  for (const raw of content) {
    const block = asObject(raw);
    if (block?.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
    next = update(next, block.tool_use_id, 'tool', (t) => ({ ...t, result: resultText(block.content), status: block.is_error ? 'error' : 'done' }));
  }
  return next;
}

/** One line the CLI printed, applied to the chat. Lines it cannot read, and kinds the panel does not draw, change nothing. */
export function applyLine(state: ChatState, cursor: StreamCursor, line: string): { state: ChatState; cursor: StreamCursor } {
  let message: Json | null;
  try {
    message = asObject(JSON.parse(line));
  } catch {
    message = null;
  }
  if (!message) return { state, cursor };
  const same = { state, cursor };
  switch (message.type) {
    case 'system': {
      const sessionId = str(message.session_id);
      if (message.subtype === 'init' && sessionId) return { state: { ...state, sessionId }, cursor };
      return same;
    }
    case 'stream_event': {
      const event = asObject(message.event);
      if (!event) return same;
      if (event.type === 'message_start') return { state, cursor: { ...cursor, messageId: str(asObject(event.message)?.id) } };
      const index = typeof event.index === 'number' ? event.index : 0;
      const id = `a:${cursor.messageId ?? 'message'}:${index}`;
      if (event.type === 'content_block_start' && asObject(event.content_block)?.type === 'text') {
        return { state: { ...state, items: upsert(state.items, { kind: 'assistant', id, text: '', streaming: true }) }, cursor };
      }
      const delta = asObject(event.delta);
      if (event.type === 'content_block_delta' && delta?.type === 'text_delta' && typeof delta.text === 'string') {
        const text = delta.text;
        const has = state.items.some((i) => i.id === id);
        const items = has ? update(state.items, id, 'assistant', (a) => ({ ...a, text: a.text + text })) : upsert(state.items, { kind: 'assistant', id, text, streaming: true });
        return { state: { ...state, items }, cursor };
      }
      return same;
    }
    case 'assistant': {
      // Text from a subagent stays inside its tool call.
      if (message.parent_tool_use_id) return same;
      const inner = asObject(message.message);
      if (!inner) return same;
      const streamed = state.items.some((i) => i.kind === 'assistant' && i.id.startsWith(`a:${str(inner.id) ?? 'message'}:`));
      return { state: { ...state, items: assistantBlocks(state.items, inner, streamed) }, cursor };
    }
    case 'user': {
      const inner = asObject(message.message);
      return inner ? { state: { ...state, items: toolResults(state.items, inner) }, cursor } : same;
    }
    case 'control_request': {
      const request = asObject(message.request);
      const id = str(message.request_id);
      if (request?.subtype !== 'can_use_tool' || !id) return same;
      const tool = str(request.tool_name) ?? 'tool';
      const reason = str(request.decision_reason) ?? str(request.description) ?? str(request.title);
      const item: ChatItem = { kind: 'permission', id, tool, label: toolLabel(tool), summary: toolSummary(request.input), input: pretty(request.input), reason, answer: 'pending' };
      return { state: { ...state, items: upsert(state.items, item) }, cursor };
    }
    case 'control_cancel_request': {
      const id = str(message.request_id);
      return id ? { state: { ...state, items: update(state.items, id, 'permission', (p) => (p.answer === 'pending' ? { ...p, answer: 'canceled' } : p)) }, cursor } : same;
    }
    case 'result': {
      const items = withdrawPrompts(state.items).map((i) => (i.kind === 'assistant' && i.streaming ? { ...i, streaming: false } : i.kind === 'tool' && i.status === 'running' ? { ...i, status: 'error' as const, result: i.result ?? 'Stopped before it finished.' } : i));
      const stopped = state.status === 'stopping';
      const error = message.is_error === true && !stopped ? str(message.result) ?? (Array.isArray(message.errors) ? message.errors.join('\n') : 'Claude Code ended the turn with an error.') : null;
      const notices = cursor.notices + 1;
      const notice: ChatItem | null = stopped ? { kind: 'notice', id: `n:${notices}`, text: 'Stopped.', tone: 'info' } : error ? { kind: 'notice', id: `n:${notices}`, text: error, tone: 'error' } : null;
      return { state: { ...state, status: 'idle', items: notice ? [...items, notice] : items }, cursor: notice ? { ...cursor, notices } : cursor };
    }
    default:
      return same;
  }
}

// ---------- A saved transcript ----------

/** The most items a resumed session shows; earlier ones stay in the transcript. */
export const TRANSCRIPT_LIMIT = 300;

/** Text the CLI writes into user messages for itself (command output, reminders), never typed by the Owner. */
const machineText = (text: string) => /^\s*<(command-|local-command-|system-reminder|bash-|user-memory|task-notification|lathe-focus)/.test(text);

/** A user message's typed text, or null when it holds none (tool results, the CLI's own text). */
export function promptText(content: unknown): string | null {
  if (typeof content === 'string') return machineText(content) || !content.trim() ? null : content;
  if (!Array.isArray(content)) return null;
  const text = content.map((b: { type?: string; text?: string }) => (b?.type === 'text' && typeof b.text === 'string' && !machineText(b.text) ? b.text : '')).filter(Boolean).join('\n');
  return text.trim() ? text : null;
}

/** The chat of a saved session, from its transcript's lines (the CLI's own session file): the main thread's messages, tool calls and results. */
export function transcriptItems(lines: Iterable<string>): ChatItem[] {
  let items: ChatItem[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Json | null;
    try {
      entry = asObject(JSON.parse(line));
    } catch {
      continue;
    }
    if (!entry || entry.isSidechain || entry.isMeta || entry.isCompactSummary) continue;
    const uuid = str(entry.uuid);
    if (uuid) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
    }
    const message = asObject(entry.message);
    if (!message) continue;
    if (entry.type === 'user') {
      const text = promptText(message.content);
      if (text) items = [...items, { kind: 'user', id: `u:saved:${n++}`, text, images: 0 }];
      else items = toolResults(items, message);
    } else if (entry.type === 'assistant') {
      items = assistantBlocks(items, message, false);
    }
  }
  // A saved session has no turn under way: a tool with no result was cut off.
  items = items.map((i) => (i.kind === 'tool' && i.status === 'running' ? { ...i, status: 'error' as const, result: i.result ?? 'No result was saved.' } : i));
  if (items.length <= TRANSCRIPT_LIMIT) return items;
  const kept = items.slice(-TRANSCRIPT_LIMIT);
  return [{ kind: 'notice', id: 'n:earlier', text: `${items.length - TRANSCRIPT_LIMIT} earlier items are in the session's transcript.`, tone: 'info' }, ...kept];
}
