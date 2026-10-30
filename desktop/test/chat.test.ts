import { describe, expect, it } from 'vitest';
import { applyLine, chatPatch, claudeArgs, EMPTY_CHAT, interruptLine, NEW_CURSOR, permissionLine, toolLabel, toolSummary, transcriptItems, TRANSCRIPT_LIMIT, userLine, type ChatState } from '../src/chat.ts';

const line = (m: object) => JSON.stringify(m);
function run(lines: object[], from: ChatState = { ...EMPTY_CHAT, status: 'running' }) {
  let state = from;
  let cursor = NEW_CURSOR;
  for (const l of lines) ({ state, cursor } = applyLine(state, cursor, line(l)));
  return state;
}

describe('LA-PLT-UC19-R01-T02 The chat runs the CLI headless, with structured input and output', () => {
  it('starts, resumes and forks with the CLI\'s own flags', () => {
    const base = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio'];
    expect(claudeArgs({})).toEqual(base);
    expect(claudeArgs({ resume: 'abc' })).toEqual([...base, '--resume', 'abc']);
    expect(claudeArgs({ resume: 'abc', fork: true })).toEqual([...base, '--resume', 'abc', '--fork-session']);
  });

  it('writes the Owner\'s message, a permission answer and Stop as the SDK does', () => {
    expect(JSON.parse(userLine('/compact'))).toEqual({ type: 'user', session_id: '', message: { role: 'user', content: [{ type: 'text', text: '/compact' }] }, parent_tool_use_id: null });
    expect(JSON.parse(permissionLine('r1', true, { command: 'ls' }))).toEqual({ type: 'control_response', response: { subtype: 'success', request_id: 'r1', response: { behavior: 'allow', updatedInput: { command: 'ls' } } } });
    expect(JSON.parse(permissionLine('r2', false, {})).response.response.behavior).toBe('deny');
    expect(JSON.parse(interruptLine('s1'))).toEqual({ type: 'control_request', request_id: 's1', request: { subtype: 'interrupt' } });
  });
});

describe('LA-PLT-UC19-R03-T02 The CLI\'s stream becomes the chat\'s text, tool rows and prompts', () => {
  it('streams text, then completes it without drawing it twice', () => {
    const state = run([
      { type: 'system', subtype: 'init', session_id: 's-1' },
      { type: 'stream_event', event: { type: 'message_start', message: { id: 'm1' } } },
      { type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello ' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'there' } } },
      { type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'Hello there' }] } },
    ]);
    expect(state.sessionId).toBe('s-1');
    expect(state.items).toEqual([{ kind: 'assistant', id: 'a:m1:0', text: 'Hello there', streaming: false }]);
  });

  it('shows a tool call as a row with a one-line summary, closed by its result', () => {
    const state = run([
      { type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', id: 't1', name: 'mcp__plugin_lathe_lathe__use_case_add_use_case', input: { id: 'TL-UC01', title: 'Borrow', capability_id: 'TL-CAP01' } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'Added use_case TL-UC01' }] }] } },
      { type: 'assistant', message: { id: 'm3', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'false' } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: 'exit 1', is_error: true }] } },
    ]);
    expect(state.items).toMatchObject([
      { kind: 'tool', id: 't1', name: 'mcp__plugin_lathe_lathe__use_case_add_use_case', summary: 'TL-UC01', result: 'Added use_case TL-UC01', status: 'done' },
      { kind: 'tool', id: 't2', summary: 'false', result: 'exit 1', status: 'error' },
    ]);
    expect(toolLabel('mcp__plugin_lathe_lathe__add')).toBe('lathe add');
    expect(toolLabel('Bash')).toBe('Bash');
    expect(toolSummary({ file_path: '/a/b.ts' })).toBe('/a/b.ts');
  });

  it('keeps a subagent\'s text inside its tool call', () => {
    const state = run([{ type: 'assistant', parent_tool_use_id: 't9', message: { id: 'm4', content: [{ type: 'text', text: 'inner' }] } }]);
    expect(state.items).toEqual([]);
  });

  it('adds a permission prompt, withdrawn when the CLI cancels it', () => {
    const asked = run([{ type: 'control_request', request_id: 'p1', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'rm x' }, tool_use_id: 't3', decision_reason: 'Changes files' } }]);
    expect(asked.items).toMatchObject([{ kind: 'permission', id: 'p1', tool: 'Bash', summary: 'rm x', reason: 'Changes files', answer: 'pending' }]);
    const canceled = run([{ type: 'control_cancel_request', request_id: 'p1' }], asked);
    expect(canceled.items[0]).toMatchObject({ answer: 'canceled' });
  });

  it('ends the turn on its result, saying why when it failed or was stopped', () => {
    expect(run([{ type: 'result', is_error: false, result: 'ok' }])).toMatchObject({ status: 'idle', items: [] });
    expect(run([{ type: 'result', is_error: true, result: 'Failed to authenticate' }]).items).toMatchObject([{ kind: 'notice', tone: 'error', text: 'Failed to authenticate' }]);
    expect(run([{ type: 'result', is_error: true, result: '' }], { ...EMPTY_CHAT, status: 'stopping' }).items).toMatchObject([{ kind: 'notice', tone: 'info', text: 'Stopped.' }]);
  });

  it('ignores lines it cannot read', () => {
    const state = { ...EMPTY_CHAT };
    expect(applyLine(state, NEW_CURSOR, 'not json').state).toBe(state);
    expect(applyLine(state, NEW_CURSOR, line({ type: 'system', subtype: 'status' })).state).toBe(state);
  });

  it('sends the page only what changed', () => {
    const one = run([{ type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'a' }] } }]);
    const two = run([{ type: 'assistant', message: { id: 'm2', content: [{ type: 'text', text: 'b' }] } }], one);
    expect(chatPatch(null, one)).toMatchObject({ reset: true, items: [{ at: 0 }] });
    const patch = chatPatch(one, two);
    expect(patch.reset).toBe(false);
    expect(patch.items.map((i) => i.at)).toEqual([1]);
    expect(chatPatch(two, { ...two, items: [] }).reset).toBe(true);
  });
});

describe('LA-PLT-UC19-R05-T03 A resumed session shows its saved conversation', () => {
  const entry = (o: object) => JSON.stringify({ uuid: Math.random().toString(36), ...o });
  it('reads the main thread\'s prompts, text and tool calls, and skips the CLI\'s own lines', () => {
    const items = transcriptItems([
      entry({ type: 'user', message: { role: 'user', content: 'What is LA-PLT?' } }),
      entry({ type: 'user', isMeta: true, message: { role: 'user', content: 'meta' } }),
      entry({ type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } }),
      entry({ type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'The Platform domain.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a' } }] } }),
      entry({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file text' }] } }),
      entry({ type: 'assistant', isSidechain: true, message: { id: 'm2', content: [{ type: 'text', text: 'subagent' }] } }),
      entry({ type: 'assistant', message: { id: 'm3', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'ls' } }] } }),
      'not json',
    ]);
    expect(items).toMatchObject([
      { kind: 'user', text: 'What is LA-PLT?' },
      { kind: 'assistant', text: 'The Platform domain.', streaming: false },
      { kind: 'tool', id: 't1', result: 'file text', status: 'done' },
      { kind: 'tool', id: 't2', status: 'error', result: 'No result was saved.' },
    ]);
  });

  it('shows only the last items of a long session', () => {
    const lines = Array.from({ length: TRANSCRIPT_LIMIT + 5 }, (_, i) => entry({ type: 'user', message: { content: `q${i}` } }));
    const items = transcriptItems(lines);
    expect(items).toHaveLength(TRANSCRIPT_LIMIT + 1);
    expect(items[0]).toMatchObject({ kind: 'notice', text: '5 earlier items are in the session\'s transcript.' });
  });
});
