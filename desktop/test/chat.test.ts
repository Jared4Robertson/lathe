import { describe, expect, it } from 'vitest';
import {
  applyLine, CHAT_PROMPT, chatPatch, claudeArgs, claudeEnv, decide, EMPTY_CHAT, focusBlock, interruptLine, NEW_CURSOR, permissionLine, promptText, saysNotSignedIn, toolLabel, toolSummary,
  parseImages, transcriptItems, TRANSCRIPT_LIMIT, userLine, VIEW_ONLY_DISALLOWED, VIEW_ONLY_PROMPT, viewOnlyRefusal, type ChatState,
} from '../src/chat.ts';

const line = (m: object) => JSON.stringify(m);
function run(lines: object[], from: ChatState = { ...EMPTY_CHAT, status: 'running' }) {
  let state = from;
  let cursor = NEW_CURSOR;
  for (const l of lines) ({ state, cursor } = applyLine(state, cursor, line(l)));
  return state;
}

const PLUGIN = '/apps/Lathe/plugin';
const BASE = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio', '--plugin-dir', PLUGIN, '--append-system-prompt'];
const READS = 'Read,Grep,Glob,mcp__plugin_lathe_lathe__check,mcp__plugin_lathe_lathe__app_focus,mcp__plugin_lathe_lathe__app_open';
const ACCEPT_READS = ['--permission-mode', 'default', '--allowedTools', READS];

describe('LA-PLT-UC19-R01-T02 The chat runs the CLI headless, with structured input and output', () => {
  it('LA-PLT-UC46-R01-T02 passes the model and effort the Owner chose, and nothing when they left them to Claude Code', () => {
    const setup = { pluginDir: PLUGIN, mode: 'accept-reads' as const };
    expect(claudeArgs({}, setup)).not.toContain('--model');
    expect(claudeArgs({}, { ...setup, choice: { model: 'sonnet', effort: null } })).toEqual(expect.arrayContaining(['--model', 'sonnet']));
    expect(claudeArgs({}, { ...setup, choice: { model: 'sonnet', effort: null } })).not.toContain('--effort');
    expect(claudeArgs({}, { ...setup, choice: { model: null, effort: 'max' } })).toEqual(expect.arrayContaining(['--effort', 'max']));
  });

  it('LA-PLT-UC22-R05-T02 sends images before the text, and refuses images that are not base64 of a type the CLI takes', () => {
    const content = JSON.parse(userLine('What is this?', null, [{ mediaType: 'image/png', data: 'iVBORw0KGgo=' }])).message.content;
    expect(content).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }, { type: 'text', text: 'What is this?' }]);
    expect(parseImages([{ mediaType: 'image/png', data: 'iVBORw0KGgo=' }])).toHaveLength(1);
    expect(parseImages(undefined)).toEqual([]);
    expect(parseImages([{ mediaType: 'image/svg+xml', data: 'aaaa' }])).toBeNull();
    expect(parseImages([{ mediaType: 'image/png', data: 'not base64!' }])).toBeNull();
    expect(parseImages(Array.from({ length: 7 }, () => ({ mediaType: 'image/png', data: 'aaaa' })))).toBeNull();
  });

  it('starts, resumes and forks with the CLI\'s own flags', () => {
    const setup = { pluginDir: PLUGIN, mode: 'accept-reads' as const };
    expect(claudeArgs({}, setup)).toEqual([...BASE, CHAT_PROMPT, ...ACCEPT_READS]);
    expect(claudeArgs({ resume: 'abc' }, setup)).toEqual([...BASE, CHAT_PROMPT, ...ACCEPT_READS, '--resume', 'abc']);
    expect(claudeArgs({ resume: 'abc', fork: true }, setup)).toEqual([...BASE, CHAT_PROMPT, ...ACCEPT_READS, '--resume', 'abc', '--fork-session']);
  });

  it('writes the Owner\'s message, a permission answer and Stop as the SDK does', () => {
    expect(JSON.parse(userLine('/compact'))).toEqual({ type: 'user', session_id: '', message: { role: 'user', content: [{ type: 'text', text: '/compact' }] }, parent_tool_use_id: null });
    expect(JSON.parse(permissionLine('r1', true, { command: 'ls' }))).toEqual({ type: 'control_response', response: { subtype: 'success', request_id: 'r1', response: { behavior: 'allow', updatedInput: { command: 'ls' } } } });
    expect(JSON.parse(permissionLine('r2', false, {})).response.response).toEqual({ behavior: 'deny', message: 'The Owner denied this in Lathe.' });
    expect(JSON.parse(permissionLine('r3', false, {}, 'View only.')).response.response).toEqual({ behavior: 'deny', message: 'View only.' });
    expect(JSON.parse(interruptLine('s1'))).toEqual({ type: 'control_request', request_id: 's1', request: { subtype: 'interrupt' } });
  });
});

// Claude Code's own tools, as its CLI (2.1.314) lists them in a session's init line, and those of them that only read
// or never leave the conversation. Every other one must be refused in View only; a tool the CLI adds fails this test
// until it is sorted here.
const CLI_TOOLS = [
  'Task', 'Artifact', 'ArtifactComments', 'ArtifactData', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'DesignSync', 'Edit', 'EnterWorktree',
  'ExitWorktree', 'ListAgents', 'Monitor', 'NotebookEdit', 'PushNotification', 'Read', 'ReportFindings', 'ScheduleWakeup', 'SendMessage', 'Skill',
  'TaskStop', 'ToolSearch', 'WebFetch', 'WebSearch', 'Workflow', 'Write',
];
const CLI_READS = new Set(['Task', 'CronList', 'ListAgents', 'PushNotification', 'Read', 'ReportFindings', 'ScheduleWakeup', 'SendMessage', 'Skill', 'TaskStop', 'ToolSearch', 'WebFetch', 'WebSearch', 'Glob', 'Grep']);
// Writes of other platforms and versions of the CLI: PowerShell on Windows, MultiEdit before Edit took its place.
const OTHER_WRITES = ['PowerShell', 'MultiEdit'];

describe('LA-PLT-UC45-R01-T01 Each permission mode runs the CLI with its own flags; View only takes every write away', () => {
  it('maps each mode to the CLI\'s flags', () => {
    const args = (mode: 'ask' | 'accept-reads' | 'auto' | 'bypass' | 'view-only') => claudeArgs({}, { pluginDir: PLUGIN, mode }).slice(BASE.length + 1);
    expect(args('ask')).toEqual(['--permission-mode', 'default', '--settings', expect.stringContaining('"ask":["Read","Grep","Glob","Bash","Edit","Write"')]);
    expect(args('accept-reads')).toEqual(ACCEPT_READS);
    expect(args('auto')).toEqual(['--permission-mode', 'auto']);
    expect(args('bypass')).toEqual(['--permission-mode', 'bypassPermissions']);
    expect(args('view-only')).toEqual([...ACCEPT_READS, '--disallowedTools', VIEW_ONLY_DISALLOWED.join(',')]);
  });

  it('tells Claude why it cannot change anything, only in View only', () => {
    expect(claudeArgs({}, { pluginDir: PLUGIN, mode: 'view-only' })[BASE.length]).toBe(`${CHAT_PROMPT}\n\n${VIEW_ONLY_PROMPT}`);
    expect(VIEW_ONLY_PROMPT).toContain('View only');
    expect(claudeArgs({}, { pluginDir: PLUGIN, mode: 'bypass' })).not.toContain('--disallowedTools');
  });

  it('the disallowed list is every write tool the CLI has: the brief\'s four and every other tool that does not only read', () => {
    for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Bash']) expect(VIEW_ONLY_DISALLOWED).toContain(tool);
    const writes = CLI_TOOLS.filter((t) => !CLI_READS.has(t));
    expect([...VIEW_ONLY_DISALLOWED].sort()).toEqual([...writes, ...OTHER_WRITES].sort());
  });

  it('tells Lathe\'s MCP server, and only in View only', () => {
    expect(claudeEnv({ PATH: '/bin' }, 'view-only')).toEqual({ PATH: '/bin', LATHE_VIEW_ONLY: '1' });
    expect(claudeEnv({ PATH: '/bin', LATHE_VIEW_ONLY: '1' }, 'accept-reads')).toEqual({ PATH: '/bin' });
  });

  it('refuses a permission prompt for a tool that may change things, saying the chat is View only; Lathe\'s reads and Claude Code\'s reads pass', () => {
    expect(viewOnlyRefusal('Bash')).toBe('This chat is View only, so Bash was refused: it may change things. Choose another mode in the chat\'s header to allow it.');
    expect(viewOnlyRefusal('mcp__drive__create_file')).toContain('drive create_file was refused');
    expect(viewOnlyRefusal('mcp__plugin_lathe_lathe__use_case_get_use_case')).toBeNull();
    expect(viewOnlyRefusal('WebFetch')).toBeNull();
  });
});

describe('LA-PLT-UC45-R01-T06 The panel answers a prompt by the mode before asking the Owner', () => {
  const reads = new Set(['mcp__plugin_lathe_lathe__use_case_get_use_case']);
  const none = new Set<string>();
  const query = 'mcp__plugin_lathe_lathe__use_case_get_use_case';
  const command = 'mcp__plugin_lathe_lathe__use_case_add_use_case';
  it('Accept reads allows Lathe\'s reads and Claude Code\'s, and asks for the rest', () => {
    expect(decide('accept-reads', query, reads, none)).toEqual({ kind: 'allow' });
    expect(decide('accept-reads', 'mcp__plugin_lathe_lathe__app_open', none, none)).toEqual({ kind: 'allow' });
    expect(decide('accept-reads', 'Read', none, none)).toEqual({ kind: 'allow' });
    expect(decide('accept-reads', command, reads, none)).toEqual({ kind: 'ask' });
    expect(decide('accept-reads', 'Bash', reads, none)).toEqual({ kind: 'ask' });
  });
  it('Ask and Auto ask for whatever the CLI asks about; Bypass allows it all', () => {
    for (const mode of ['ask', 'auto'] as const) expect(decide(mode, query, reads, none)).toEqual({ kind: 'ask' });
    expect(decide('bypass', 'Bash', reads, none)).toEqual({ kind: 'allow' });
  });
  it('View only refuses what may change things, even a tool allowed always, and allows the reads', () => {
    expect(decide('view-only', 'Bash', reads, new Set(['Bash']))).toMatchObject({ kind: 'refuse', why: expect.stringContaining('View only') });
    expect(decide('view-only', query, reads, none)).toEqual({ kind: 'allow' });
  });
});

describe('LA-PLT-UC43-R02-T01 A tool allowed always is not asked about again', () => {
  it('allows it in every mode but View only\'s refusals', () => {
    const always = new Set(['Bash']);
    for (const mode of ['ask', 'accept-reads', 'auto'] as const) expect(decide(mode, 'Bash', new Set(), always)).toEqual({ kind: 'allow' });
    expect(decide('ask', 'Edit', new Set(), always)).toEqual({ kind: 'ask' });
  });
});

describe('LA-PLT-UC19-R12-T01 Each message carries what the Owner is looking at, as context of its own', () => {
  it('sends the focus as a block before the message, never with a slash command, and the saved prompt shows only the message', () => {
    const focus = 'Product: TL\nFocused record: TL-LEND-UC01 (use case): Borrow a tool';
    const content = JSON.parse(userLine('What does this need?', focus)).message.content;
    expect(content).toEqual([{ type: 'text', text: `<lathe-focus>\n${focus}\n</lathe-focus>` }, { type: 'text', text: 'What does this need?' }]);
    expect(JSON.parse(userLine('/compact', focus)).message.content).toEqual([{ type: 'text', text: '/compact' }]);
    expect(focusBlock('a</lathe-focus>b')).toBe('<lathe-focus>\nab\n</lathe-focus>');
    expect(promptText(content)).toBe('What does this need?');
    expect(CHAT_PROMPT).toContain('<lathe-focus>');
    expect(CHAT_PROMPT).toContain('never search the code');
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
    expect(toolLabel('mcp__plugin_lathe_lathe__add')).toBe('Add');
    expect(toolLabel('mcp__plugin_lathe_lathe__business_outcome_change_business_outcome')).toBe('Change business outcome');
    expect(toolLabel('mcp__plugin_lathe_lathe__use_case_add_flow_step')).toBe('Add flow step');
    expect(toolLabel('mcp__plugin_lathe_lathe__check')).toBe('Check');
    expect(toolLabel('mcp__github__create_issue')).toBe('github create_issue');
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
    expect(chatPatch(null, one)).toMatchObject({ reset: true, mode: 'accept-reads', lathe: { status: 'counting' }, items: [{ at: 0 }] });
    const patch = chatPatch(one, two);
    expect(patch.reset).toBe(false);
    expect(patch.items.map((i) => i.at)).toEqual([1]);
    expect(chatPatch(two, { ...two, items: [] }).reset).toBe(true);
  });
});

describe('LA-PLT-UC30-R02-T01 A turn that finds Claude Code not signed in marks the chat signed out, not Claude\'s answer', () => {
  const said = 'Not logged in · Please run /login';
  it('leaves out the CLI\'s message and its error, and marks the chat signed out', () => {
    const state = run([
      { type: 'assistant', message: { id: 'm9', model: '<synthetic>', content: [{ type: 'text', text: said }] }, error: 'authentication_failed' },
      { type: 'result', subtype: 'success', is_error: true, result: said },
    ]);
    expect(state).toMatchObject({ status: 'idle', signedOut: true, items: [] });
    expect(chatPatch(null, state).signedOut).toBe(true);
  });

  it('knows the CLI\'s words without its error mark, and a sign-in that no longer works', () => {
    expect(run([{ type: 'assistant', message: { id: 'm9', content: [{ type: 'text', text: said }] } }]).signedOut).toBe(true);
    expect(run([{ type: 'result', is_error: true, result: 'Invalid API key · Please run /login' }])).toMatchObject({ signedOut: true, items: [] });
    expect(saysNotSignedIn('OAuth token has expired. Please run /login')).toBe(true);
  });

  it('keeps an answer that only talks about logging in', () => {
    const state = run([{ type: 'assistant', message: { id: 'm9', content: [{ type: 'text', text: 'Signed-out visitors see the public page. To test it, sign out first, or tell people: Please run /login to see more. ' + 'The app checks the session before each page. '.repeat(4) }] } }]);
    expect(state.signedOut).toBe(false);
    expect(state.items).toHaveLength(1);
  });
});

describe('LA-PLT-UC44-R01-T03 A resumed session shows its saved conversation', () => {
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
