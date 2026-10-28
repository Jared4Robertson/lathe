#!/usr/bin/env node
// A stand-in for the `claude` CLI in headless stream-json mode, for the chat tests and screenshots: it
// speaks the same lines (system init, streamed text, tool calls and results, a can_use_tool permission
// prompt answered by a control_response, an interrupt, a result per turn) and answers by what the
// message says:
//   "permission"  asks to run a Bash command, and runs it only when allowed;
//   "tool"        reads a file with a tool;
//   "slow"        streams slowly, so it can be stopped;
//   anything else answers in Markdown, naming the record IDs the message named.
// It writes nothing anywhere: the session ID comes from --resume (a new one with --fork-session).
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
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

async function stream(text, delay) {
  const id = `msg_${++n}`;
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
  const id = `toolu_${++n}`;
  out({ type: 'assistant', message: { id: `msg_${n}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] }, parent_tool_use_id: null });
  return id;
}
const toolResult = (id, text, isError = false) => out({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }], is_error: isError }] }, parent_tool_use_id: null });

function ask(toolUseId, name, input) {
  const requestId = `perm_${++n}`;
  out({ type: 'control_request', request_id: requestId, request: { subtype: 'can_use_tool', tool_name: name, input, tool_use_id: toolUseId, decision_reason: 'This command changes files in the folder.' } });
  return new Promise((resolve) => waiting.set(requestId, resolve));
}

async function answer(text) {
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
  } else if (/tool/i.test(text)) {
    const id = toolCall('mcp__plugin_lathe_lathe__show', { id: 'SMK-ORD' });
    await sleep(20);
    toolResult(id, 'Domain SMK-ORD: Orders\n  kind: domain\n  parent: SMK');
    await stream('The domain **SMK-ORD** holds the orders.', 5);
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
    const text = typeof content === 'string' ? content : (content ?? []).map((b) => b.text ?? '').join('');
    turn = turn.then(() => answer(text));
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
