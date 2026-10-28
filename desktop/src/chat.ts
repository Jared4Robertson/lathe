// The chat panel's conversation, apart from Electron and the process (LA-PLT-UC19): the arguments the
// user's own `claude` CLI runs with, the lines the panel writes to it, and how the lines it prints
// become the chat's items. The CLI runs headless with structured input and output
// (`-p --input-format stream-json --output-format stream-json`); it asks the panel for each tool
// permission with a `can_use_tool` control request (`--permission-prompt-tool stdio`), which the
// panel answers with a `control_response`; Stop sends an `interrupt` control request.
//
// The items are what the panel draws: the Owner's messages, Claude's text (streamed as it is
// written), each tool call with its input and result, each permission prompt with its answer, and
// notices. The page gets them as patches (chatPatch); the types are repeated in the app's
// app/src/chat/types.ts, as the preload's are.

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; summary: string; input: string; result: string | null; status: 'running' | 'done' | 'error' }
  | { kind: 'permission'; id: string; tool: string; summary: string; input: string; reason: string | null; answer: 'pending' | 'allowed' | 'denied' | 'cancelled' }
  | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

/** idle: waiting for the Owner; running: a turn is under way; closed: no process (the next message starts one). */
export type ChatStatus = 'idle' | 'running' | 'stopping' | 'closed';

export interface ChatState {
  /** The Claude Code session the chat continues, once the CLI has named it. */
  sessionId: string | null;
  status: ChatStatus;
  items: ChatItem[];
}

export const EMPTY_CHAT: ChatState = { sessionId: null, status: 'closed', items: [] };

/** What the page is sent: the state's head, and the items changed since the last patch, by position. */
export interface ChatPatch {
  reset: boolean;
  sessionId: string | null;
  status: ChatStatus;
  /** Every item when reset; otherwise those new or changed, each with its position. */
  items: { at: number; item: ChatItem }[];
}

/** The patch from one state to the next: items are only appended or replaced, never removed (a new session resets). */
export function chatPatch(before: ChatState | null, after: ChatState): ChatPatch {
  const reset = !before || after.items.length < before.items.length || after.items.slice(0, before.items.length).some((item, i) => item.id !== before.items[i].id);
  const items = after.items.flatMap((item, at) => (reset || before?.items[at] !== item ? [{ at, item }] : []));
  return { reset, sessionId: after.sessionId, status: after.status, items };
}

// ---------- The CLI's arguments and input ----------

export interface StartOptions {
  /** The session to continue; none starts a new one. */
  resume?: string;
  /** Continue a copy of `resume` under a new session ID, leaving the original as it was. */
  fork?: boolean;
}

/** The CLI's arguments: headless, structured input and output, partial messages, permission prompts to the panel. */
export function claudeArgs({ resume, fork }: StartOptions): string[] {
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio'];
  if (resume) args.push('--resume', resume);
  if (resume && fork) args.push('--fork-session');
  return args;
}

/** The line that sends the Owner's message, as the Agent SDK writes it. Slash commands go as text; the CLI runs those it can headless. */
export const userLine = (text: string) => JSON.stringify({ type: 'user', session_id: '', message: { role: 'user', content: [{ type: 'text', text }] }, parent_tool_use_id: null });

/** The line that answers a permission prompt: allow once with the tool's input unchanged, or deny. */
export function permissionLine(requestId: string, allow: boolean, input: unknown): string {
  const response = allow ? { behavior: 'allow', updatedInput: input ?? {} } : { behavior: 'deny', message: 'The Owner denied this in Lathe.' };
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

/** The one line a tool row shows of its input: the command, the file, the pattern, a Lathe write's table and ID, or its first text. */
export function toolSummary(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const fields = input as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) if (typeof fields[key] === 'string' && fields[key]) return oneLine(fields[key] as string);
  // A Lathe write names its table as the only property, with the row as its value (lathe/src/cli/mcp.ts).
  const entries = Object.entries(fields);
  if (/lathe/.test(name) && entries.length === 1 && entries[0][1] && typeof entries[0][1] === 'object') {
    const [table, row] = entries[0] as [string, Record<string, unknown>];
    return oneLine(`${table} ${typeof row.id === 'string' ? row.id : Object.values(row).filter((v) => typeof v === 'string').join(' ')}`);
  }
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
  items.some((i) => i.kind === 'permission' && i.answer === 'pending') ? items.map((i) => (i.kind === 'permission' && i.answer === 'pending' ? { ...i, answer: 'cancelled' } : i)) : items;

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
      if (!existing) next = upsert(next, { kind: 'tool', id: block.id, name, summary: toolSummary(name, block.input), input: pretty(block.input), result: null, status: 'running' });
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
      const item: ChatItem = { kind: 'permission', id, tool, summary: toolSummary(tool, request.input), input: pretty(request.input), reason, answer: 'pending' };
      return { state: { ...state, items: upsert(state.items, item) }, cursor };
    }
    case 'control_cancel_request': {
      const id = str(message.request_id);
      return id ? { state: { ...state, items: update(state.items, id, 'permission', (p) => (p.answer === 'pending' ? { ...p, answer: 'cancelled' } : p)) }, cursor } : same;
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
const machineText = (text: string) => /^\s*<(command-|local-command-|system-reminder|bash-|user-memory|task-notification)/.test(text);

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
      if (text) items = [...items, { kind: 'user', id: `u:saved:${n++}`, text }];
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
