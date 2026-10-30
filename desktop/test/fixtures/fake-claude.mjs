#!/usr/bin/env node
// A stand-in for the `claude` CLI in headless stream-json mode, for the chat tests and screenshots: it
// speaks the same lines (system init, streamed text, tool calls and results, a can_use_tool permission
// prompt answered by a control_response, an interrupt, a result per turn) and answers by what the
// message says:
//   "permission"  asks to run a Bash command, and runs it only when allowed;
//   "note"        asks to use another MCP server's tool that writes a note, and uses it only when allowed;
//   "twice"       asks to run two Bash commands, one after the other;
//   "read"        asks to use a Lathe query, as the CLI does for an MCP tool no rule allows;
//   anything else with a <lathe-focus> block before it answers from the block, naming the record it holds.
//   "tool"        reads a file with a tool;
//   "slow"        streams slowly, so it can be stopped;
//   anything else answers in Markdown, naming the record IDs the message named.
// It writes nothing anywhere: the session ID comes from --resume (a new one with --fork-session). Asked
// `auth status`, it says it is signed in.
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
// `claude auth status --json`: signed in, as the chat asks before its first message.
if (args[0] === 'auth') {
  process.stdout.write(`${JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' })}\n`);
  process.exit(0);
}
const resumeAt = args.indexOf('--resume');
const resumed = resumeAt >= 0 ? args[resumeAt + 1] : null;
const sessionId = resumed && !args.includes('--fork-session') ? resumed : randomUUID();
const out = (message) => process.stdout.write(`${JSON.stringify({ ...message, session_id: sessionId })}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let started = false;
let interrupted = false;
const waiting = new Map();
let turn = Promise.resolve();
let n = 0;
// IDs unique across runs, as the real CLI's are: a session started again must not reuse an earlier run's.
const run = randomUUID().slice(0, 8);

async function stream(text, delay) {
  const id = `msg_${run}_${++n}`;
  out({ type: 'stream_event', event: { type: 'message_start', message: { id, role: 'assistant', content: [] } }, parent_tool_use_id: null });
  out({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, parent_tool_use_id: null });
  for (const word of text.match(/\S+\s*/g) ?? []) {
    if (interrupted) break;
    out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: word } }, parent_tool_use_id: null });
    await sleep(delay);
  }
  out({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'text', text }] }, parent_tool_use_id: null });
}

function toolCall(name, input) {
  const id = `toolu_${run}_${++n}`;
  out({ type: 'assistant', message: { id: `msg_${run}_${n}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] }, parent_tool_use_id: null });
  return id;
}
const toolResult = (id, text, isError = false) => out({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }], is_error: isError }] }, parent_tool_use_id: null });

function ask(toolUseId, name, input) {
  const requestId = `perm_${run}_${++n}`;
  out({ type: 'control_request', request_id: requestId, request: { subtype: 'can_use_tool', tool_name: name, input, tool_use_id: toolUseId, decision_reason: 'This command changes files in the folder.' } });
  return new Promise((resolve) => waiting.set(requestId, resolve));
}

/** Asks for a tool, and says what came of it. */
async function askFor(name, input, done) {
  const id = toolCall(name, input);
  const decision = await ask(id, name, input);
  if (decision?.behavior === 'allow') {
    toolResult(id, done);
    await stream('Done.', 5);
  } else {
    toolResult(id, decision?.message ?? 'Denied.', true);
    await stream(`I did not do it: ${decision?.message ?? 'it was denied.'}`, 5);
  }
}

async function answer(text, focus) {
  interrupted = false;
  if (!started) {
    started = true;
    out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Bash', 'Read'], model: 'fake' });
  }
  if (/permission/i.test(text)) {
    const input = { command: 'touch notes.txt', description: 'Create notes.txt' };
    const id = toolCall('Bash', input);
    const decision = await ask(id, 'Bash', input);
    if (decision?.behavior === 'allow') {
      toolResult(id, 'Created notes.txt.');
      await stream('Done: I created `notes.txt`.', 5);
    } else {
      toolResult(id, decision?.message ?? 'Denied.', true);
      await stream('All right, I left the folder as it was.', 5);
    }
  } else if (/twice/i.test(text)) {
    await askFor('Bash', { command: 'git status', description: 'Show the working tree' }, 'On branch main.');
    await askFor('Bash', { command: 'git log -1 --oneline', description: 'Show the last commit' }, '1b8c43d5 Merge 183-serves');
  } else if (/\bread\b/i.test(text)) {
    await askFor('mcp__plugin_lathe_lathe__use_case_get_use_case', { id: 'TL-LEND-UC01' }, 'Use case TL-LEND-UC01: Borrow a tool');
  } else if (/note/i.test(text)) {
    await askFor('mcp__notes__write_note', { title: 'Lending rules', text: 'Members borrow up to three tools.' }, 'Wrote the note.');
  } else if (/tool/i.test(text)) {
    const id = toolCall('mcp__plugin_lathe_lathe__show', { id: 'SMK-ORD' });
    await sleep(20);
    toolResult(id, 'Domain SMK-ORD: Orders\n  kind: domain\n  parent: SMK');
    await stream('The domain **SMK-ORD** holds the orders.', 5);
  } else if (focus) {
    const record = /Focused record: (\S+)/.exec(focus)?.[1] ?? 'the page';
    await stream(`You are looking at **${record}**, so I started from it without a tool call.`, 5);
  } else {
    const ids = [...new Set(text.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b|\b[A-Z]{2,}\b/g) ?? [])];
    const reply = ids.length
      ? `Here is what I found about ${ids.join(' and ')}:\n\n- **${ids[0]}** is the record you named.\n- Its page shows its children and links.\n\nAsk me to change it and I will use Lathe's tools.`
      : 'Hello! Ask me about a record, or to change one.';
    await stream(reply, /slow/i.test(text) ? 150 : 5);
  }
  out({ type: 'result', subtype: interrupted ? 'error_during_execution' : 'success', is_error: interrupted, result: interrupted ? '' : 'ok', duration_ms: 1, num_turns: 1 });
}

createInterface({ input: process.stdin }).on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.type === 'user') {
    const content = message.message?.content;
    const blocks = typeof content === 'string' ? [content] : (content ?? []).map((b) => b.text ?? '');
    const focusAt = blocks.findIndex((b) => b.startsWith('<lathe-focus>'));
    const focus = focusAt >= 0 ? blocks[focusAt] : null;
    const text = blocks.filter((_, i) => i !== focusAt).join('');
    turn = turn.then(() => answer(text, focus));
  } else if (message.type === 'control_response') {
    const id = message.response?.request_id;
    waiting.get(id)?.(message.response?.response);
    waiting.delete(id);
  } else if (message.type === 'control_request' && message.request?.subtype === 'interrupt') {
    interrupted = true;
    for (const [id, resolve] of waiting) {
      out({ type: 'control_cancel_request', request_id: id });
      resolve({ behavior: 'deny', message: 'Interrupted.' });
    }
    waiting.clear();
    out({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { still_queued: [] } } });
  }
});
