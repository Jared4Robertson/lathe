import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { diffLines } from '../src/views/history';
import { sideModeOf, sideStateFrom } from '../src/views/sideBarState';
import { entityWorkspace } from './fixtures/entities';
import { main, openApp, openSideBar, sideBar } from './helpers';
import { testWorkspace } from './graph/workspace';

// The side bar (brief 64, LA-EXP-UC12): a secondary side bar with three views,
// Details, Outline and History, closed in the Wiki view and open in the Graph and Model views,
// remembered per view mode and per tab.

const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const side = () => within(sideBar());
const switcher = () => within(side().getByRole('group', { name: 'Side bar views' }));
const name = () => sideBar().querySelector('.side-bar-name')?.textContent;

/** Answers GET /api/history with `answer` (by the query asked), on top of the specs the page loads. */
function serveHistory(answer: (query: URLSearchParams) => unknown) {
  const base = globalThis.fetch;
  const asked: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api/history')) return base(input, init);
    asked.push(url);
    const query = new URL(url, 'http://lathe.local').searchParams;
    return new Response(JSON.stringify(answer(query)), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return asked;
}

describe('the side bar', () => {
  it('LA-PLT-T87 One side bar with a labeled switcher of Details, Outline and History, each with its heading; closed in the Wiki view and open in the Graph view, its view kept per view mode and per tab across a reload', async () => {
    expect(sideModeOf(['wiki'], false)).toBe('wiki');
    expect(sideModeOf(['wiki', 'graph'], false)).toBe('graph');
    expect(sideModeOf(['wiki', 'model'], false)).toBe('model');
    expect(sideModeOf(['graph'], true)).toBe('graph');
    expect(sideStateFrom({ wiki: { open: 'yes', view: 'details' }, graph: { open: true, view: 'nope' }, model: { open: false, view: 'history' } })).toEqual({ model: { open: false, view: 'history' } });

    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();

    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const buttons = switcher().getAllByRole('button');
    expect(buttons.map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([['Details', 'true'], ['Outline', 'false'], ['History', 'false']]);
    expect(side().getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument();
    // Switching keeps focus on the switch pressed, and names the new view.
    const outline = switcher().getByRole('button', { name: 'Outline' });
    outline.focus();
    fireEvent.click(outline);
    expect(outline).toHaveAttribute('aria-pressed', 'true');
    expect(outline).toHaveFocus();
    expect(side().getByRole('heading', { level: 2, name: 'Outline' })).toBeInTheDocument();
    expect(sideBar().querySelector('#side-view')).toHaveAttribute('aria-labelledby', 'side-view-title');

    // A reload brings the tab back with Outline in the Graph view (LA-PAT-APP-UX-R06).
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(switcher().getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-pressed', 'true');
    // The Wiki view of the same tab keeps its own: closed.
    fireEvent.click(screen.getByRole('button', { name: /^Wiki/, pressed: false }));
    fireEvent.click(screen.getByRole('button', { name: /^Graph/, pressed: true }));
    await waitFor(() => expect(window.location.search).toBe('?view=wiki'));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
  });

  it('LA-EXP-T161 In the Graph view Details shows the node under the pointer or keyboard focus, else the selected one, else the page\'s record, with Open and a compact Traceability; the graph adds what it connects', async () => {
    window.sessionStorage.setItem('lathe:graph-settings', JSON.stringify({ depth: 1, trace: false, hiddenKinds: [], hiddenRelations: [], openGroups: [], links: true, context: true, minimap: false }));
    await openApp('/P-D-UC01-R01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    expect(name()).toBe('The owner is shown');
    expect(side().queryByRole('link', { name: 'Open' })).toBeNull();
    const trace = side().getByRole('region', { name: /^Traceability/ });
    expect(within(trace).getByText(/^Designed by/)).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: 'P-D-C01' })).toBeInTheDocument();
    expect(side().getByText('Spec file')).toBeInTheDocument();
    await waitFor(() => expect(side().getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());

    // Hover: the node lit by the spotlight.
    fireEvent.mouseEnter(node('P-D-V01')!);
    await waitFor(() => expect(name()).toBe('Thing page'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Under the pointer/);
    expect(side().getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/P-D-V01?view=graph');
    // Leaving gives the page's record back, in the same box.
    const box = sideBar();
    fireEvent.mouseLeave(node('P-D-V01')!);
    await waitFor(() => expect(name()).toBe('The owner is shown'));
    expect(sideBar()).toBe(box);
    // Keyboard focus does the same.
    node('P-D-C01')!.focus();
    await waitFor(() => expect(name()).toBe('Thing service'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Under the pointer/);
    fireEvent.blur(node('P-D-C01')!);
    await waitFor(() => expect(name()).toBe('The owner is shown'));
  });

  it('LA-EXP-T162 In the Wiki view Details shows only what the page does not: the spec file, the raw header fields and the raw links; a focused or right-clicked record row shows that record', async () => {
    openSideBar();
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(side().getByRole('heading', { name: 'Spec file' })).toBeInTheDocument();
    expect(side().getByRole('heading', { name: 'Header fields' })).toBeInTheDocument();
    expect(side().getByText('actor', { selector: 'dt code' })).toBeInTheDocument();
    expect(side().getByText('applies', { selector: 'code' })).toBeInTheDocument();
    // Nothing the wiki shows: no children, no problems list, no identity block.
    expect(side().queryByRole('heading', { name: /^UC requirements/ })).toBeNull();
    expect(side().queryByRole('heading', { name: /^Problems/ })).toBeNull();
    expect(name()).toBeUndefined();

    // A record row with focus: its details.
    const wiki = screen.getByRole('region', { name: 'Wiki pane' });
    const row = within(wiki).getAllByRole('link', { name: /^P-D-UC01-R01/ }).find((a) => a.classList.contains('row-link'))!;
    fireEvent.focusIn(row);
    await waitFor(() => expect(name()).toBe('The owner is shown'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Selected/);
    fireEvent.focusOut(row, { relatedTarget: document.body });
    await waitFor(() => expect(name()).toBeUndefined());
    // Right-clicked: it stays until a click elsewhere.
    fireEvent.contextMenu(row);
    await waitFor(() => expect(name()).toBe('The owner is shown'));
    fireEvent.pointerDown(main().querySelector('.pane-title')!, { button: 0 });
    await waitFor(() => expect(name()).toBeUndefined());
  });

  it('LA-PLT-T88 Outline lists the wiki\'s sections, scrolls there on a click and marks the one in view; in the Model view it lists the boxes', async () => {
    openSideBar('outline');
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const sections = await waitFor(() => side().getByRole('list', { name: 'Sections' }));
    const rows = within(sections).getAllByRole('button').map((b) => b.textContent);
    expect(rows).toEqual(expect.arrayContaining(['Traceability', 'Problems']));
    const pane = screen.getByRole('region', { name: 'Wiki pane' }).querySelector<HTMLElement>('.pane-scroll')!;
    const scrollTo = vi.fn();
    pane.scrollTo = scrollTo as unknown as typeof pane.scrollTo;
    const problems = within(sections).getByRole('button', { name: 'Problems' });
    fireEvent.click(problems);
    expect(scrollTo).toHaveBeenCalled();
    expect(problems).toHaveAttribute('aria-current', 'location');

    // The Model view: the boxes, those in focus first.
    openSideBar('outline', ['model']);
    await openApp('/P-D?view=model', { workspace: entityWorkspace() });
    await screen.findAllByRole('heading', { level: 1 });
    await waitFor(() => expect(side().getByRole('heading', { name: /^Aggregates/ })).toBeInTheDocument());
    const boxes = side().getByRole('list', { name: 'Aggregates' });
    expect(within(boxes).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(boxes).getAllByRole('link')[0].className).toContain('row-link');
  });

  it('LA-EXP-T163 History lists the commits that touched the record\'s file, the uncommitted change first, shows a commit\'s diff inline, loads more, and says calmly when there is no git', async () => {
    const commit = (n: number) => ({ hash: `${String(n).padStart(4, '0')}${'a'.repeat(36)}`, short: `${String(n).padStart(4, '0')}aaa`, date: '2026-10-24T10:00:00Z', author: 'Owner', subject: `Change ${n}` });
    openSideBar('history');
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    // On top of the specs the page loaded: the history answers.
    const asked = serveHistory((q) => {
      if (q.get('commit') === 'working') return { state: 'ok', id: q.get('id'), file: 'specs/P-D-UC01.md', commit: 'working', diff: 'diff --git a/x b/x\n@@ -1 +1 @@\n-old line\n+new line\n', truncated: false };
      if (q.get('commit')) return { state: 'ok', id: q.get('id'), file: 'specs/P-D-UC01.md', commit: q.get('commit'), diff: '@@ -1,2 +1,2 @@\n same\n-was\n+is\n', truncated: false };
      const skip = Number(q.get('skip') ?? 0);
      return { state: 'ok', id: q.get('id'), file: 'specs/P-D-UC01.md', uncommitted: skip ? null : 'modified', commits: skip ? [commit(21)] : Array.from({ length: 20 }, (_, i) => commit(i + 1)), more: !skip };
    });
    // Show the view again, so its request goes to these answers; it asks by the record's ID.
    fireEvent.click(switcher().getByRole('button', { name: 'Details' }));
    fireEvent.click(switcher().getByRole('button', { name: 'History' }));
    const list = await side().findByRole('list', { name: 'Commits that touched specs/P-D-UC01.md' });
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Not committed');
    expect(rows[1]).toHaveTextContent(/Change 1.*Owner.*0001aaa/);
    expect(rows).toHaveLength(21);
    expect(asked[0]).toBe('/api/history?id=P-D-UC01');

    // The uncommitted change's diff, inline, its lines marked added and removed.
    fireEvent.click(rows[0]);
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
    const diff = await side().findByLabelText('Uncommitted changes');
    expect(diff.querySelector('.diff-remove')).toHaveTextContent('-old line');
    expect(diff.querySelector('.diff-add')).toHaveTextContent('+new line');
    expect(diff.querySelector('.diff-meta')).toHaveTextContent('diff --git');
    // One open at a time.
    fireEvent.click(rows[1]);
    expect(await side().findByLabelText('Diff of 0001aaa')).toBeInTheDocument();
    expect(side().queryByLabelText('Uncommitted changes')).toBeNull();

    fireEvent.click(side().getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(22));
    expect(side().queryByRole('button', { name: 'Load more' })).toBeNull();

    // No git: said calmly.
    serveHistory((q) => ({ state: 'no-repo', id: q.get('id'), file: 'specs/P-D-UC01.md', message: 'The product folder is not a git repository, so its records have no history yet.' }));
    fireEvent.click(switcher().getByRole('button', { name: 'Details' }));
    fireEvent.click(switcher().getByRole('button', { name: 'History' }));
    expect(await side().findByText(/not a git repository/)).toBeInTheDocument();

    expect(diffLines('diff --git a/x b/x\nindex 1..2\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n c\n').map((l) => l.kind)).toEqual(['meta', 'meta', 'meta', 'meta', 'hunk', 'remove', 'add', 'context']);
  });

  it('LA-EXP-T164 On a phone the side bar is a bottom sheet with the same three views', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    const sheet = screen.getByRole('dialog', { name: 'Side bar' });
    expect(within(sheet).getByRole('group', { name: 'Side bar views' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Outline' }));
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Outline' })).toBeInTheDocument();
  });
});
