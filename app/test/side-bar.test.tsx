import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { changeSummary } from '../src/views/history';
import { sideStateFrom } from '../src/views/sideBarState';
import { SETTINGS_KEY } from '../src/graph/settings';
import { modelWorkspace } from './fixtures/model';
import { openApp, openSideBar, sideBar } from './helpers';
import { testWorkspace } from './graph/workspace';
import { boxElement, hoverBox, leaveCanvas } from './graph/scene';

// The side bar (LA-EXP-UC12): a secondary side bar with three views,
// Details, Outline and History, open on the Graph and ERD stages and closed on the Trace,
// remembered per stage and per tab.

const node = (id: string) => boxElement(id);
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
  const proveLaV95R04T01 = async () => {
    expect(sideStateFrom({ wiki: { open: true, view: 'details' }, graph: { open: true, view: 'nope' }, erd: { open: false, view: 'history' }, trace: { open: 'yes', view: 'details' } })).toEqual({ erd: { open: false, view: 'history' } });

    // Closed on the Trace stage, open on the Graph.
    await openApp('/P-D-UC01?stage=trace', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();

    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
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

    // A reload brings the tab back with Outline on the Graph stage (LA-PAT-APP-UX-R06).
    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(switcher().getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-pressed', 'true');
    // The Trace stage of the same tab keeps its own: closed.
    fireEvent.click(within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name: 'Trace' }));
    await waitFor(() => expect(window.location.search).toBe('?stage=trace'));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
  };
  it('LA-V95-R04-T01 One side bar with a labeled switcher of Details, Outline and History, each with its heading; open on the Graph stage and closed on the Trace, its view kept per stage and per tab across a reload', proveLaV95R04T01);
  it('LA-V95-R05-T03 The side bar\'s switcher, its headings, and its state per stage and per tab across a reload', proveLaV95R04T01);

  it('LA-V95-R06-T01 On the Graph stage Details shows the node under the pointer or keyboard focus, else the selected one, else the page\'s record, with Open and a compact Traceability; the graph adds what it connects', async () => {
    window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout: 'tree', depth: 1, hiddenKinds: [], minimap: false, card: true, cardWidth: null, chat: false, chatWidth: null }));
    await openApp('/P-D-UC01-R01?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(node('P-D-UC01-R02')).not.toBeNull());
    expect(name()).toBe('The loan is recorded');
    expect(side().queryByRole('link', { name: 'Open' })).toBeNull();
    const trace = side().getByRole('region', { name: /^Traceability/ });
    expect(within(trace).getByText(/^Designed by/)).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: 'P-D-UC01-FL01-S01' })).toBeInTheDocument();
    expect(within(trace).getByText(/^Proved by/)).toBeInTheDocument();
    expect(side().getByText('Data file')).toBeInTheDocument();
    await waitFor(() => expect(side().getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());

    // Hover: the node lit by the spotlight.
    hoverBox('P-D-UC01-R02');
    await waitFor(() => expect(name()).toBe('A member at the limit is refused'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Under the pointer/);
    expect(side().getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/P-D-UC01-R02?stage=graph');
    // Leaving gives the page's record back, in the same box.
    const box = sideBar();
    leaveCanvas();
    await waitFor(() => expect(name()).toBe('The loan is recorded'));
    expect(sideBar()).toBe(box);
    // Keyboard focus does the same.
    node('P-D-UC01')!.focus();
    await waitFor(() => expect(name()).toBe('Lend a thing'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Under the pointer/);
    fireEvent.blur(node('P-D-UC01')!);
    await waitFor(() => expect(name()).toBe('The loan is recorded'));
  });

  const proveLaV95R06T02 = async () => {
    await openApp('/P-D-UC01-FL01-S01?stage=trace', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Librarian lends the thing' });
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    // The page's record, by default, as on every stage: the wiki card shows its text, so Details never repeats it.
    expect(name()).toBe('Librarian lends the thing');
    expect(side().getByText('Data file')).toBeInTheDocument();
    expect(side().queryByText('flow_id', { selector: 'dt code' })).toBeNull();

    // A record row of the wiki card with focus: its details.
    const card = screen.getByRole('region', { name: 'Wiki card' });
    const row = within(card).getAllByRole('link', { name: /^P-D-UC01-R01/ }).find((a) => a.classList.contains('row-link'))!;
    fireEvent.focusIn(row);
    await waitFor(() => expect(name()).toBe('The loan is recorded'));
    expect(sideBar().querySelector('.side-bar-identity .eyebrow')).toHaveTextContent(/^Selected/);
    fireEvent.focusOut(row, { relatedTarget: document.body });
    await waitFor(() => expect(name()).toBe('Librarian lends the thing'));
    // Right-clicked: it stays until a click elsewhere in the card.
    fireEvent.contextMenu(row);
    await waitFor(() => expect(name()).toBe('The loan is recorded'));
    fireEvent.pointerDown(card.querySelector('.wiki-panel-title')!, { button: 0 });
    await waitFor(() => expect(name()).toBe('Librarian lends the thing'));
  };
  it('LA-V95-R06-T02 Details describes the page\'s record, never repeating the wiki card; a focused or right-clicked record row in the card shows that record', proveLaV95R06T02);
  it('LA-V95-R01-T01 The side bar never repeats what the wiki card shows', proveLaV95R06T02);

  it('LA-V95-R07-T01 Outline lists what the stage holds: on the Graph its records by level, on the ERD its boxes', async () => {
    openSideBar('outline');
    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(side().getAllByRole('list', { name: /^Level \d$/ }).length).toBeGreaterThan(0));
    expect(within(side().getAllByRole('list', { name: /^Level \d$/ })[0]).getAllByRole('link').length).toBeGreaterThan(0);

    // The ERD stage: the boxes, those in focus first.
    await openApp('/P-D?stage=erd', { data: modelWorkspace() });
    await screen.findAllByRole('heading', { level: 1 });
    await waitFor(() => expect(side().getByRole('heading', { name: /^Aggregates/ })).toBeInTheDocument());
    const boxes = side().getByRole('list', { name: 'Aggregates' });
    expect(within(boxes).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(boxes).getAllByRole('link')[0].className).toContain('row-link');
  });

  it('LA-V95-R08-T01 History lists the commits that touched the record\'s file, the uncommitted change first, shows a commit\'s diff inline, loads more, and says calmly when there is no git', async () => {
    const statement = { table: 'use_case', key: 'P-D-UC01', change: 'changed' as const, fields: [{ name: 'goal', before: 'Lend it.', after: 'Lend a thing to a member.' }] };
    const actor = { table: 'use_case_actor', key: 'use_case_id P-D-UC01, position 1', change: 'added' as const, fields: [{ name: 'role_name', after: 'Member' }] };
    const commit = (n: number) => ({ hash: `${String(n).padStart(4, '0')}${'a'.repeat(36)}`, short: `${String(n).padStart(4, '0')}aaa`, date: '2026-10-24T10:00:00Z', author: 'Owner', subject: `Change ${n}`, changes: n === 1 ? [statement, actor] : [statement], truncated: false });
    openSideBar('history');
    await openApp('/P-D-UC01', { data: testWorkspace() });
    // On top of the data the page loaded: the history answers.
    const asked = serveHistory((q) => {
      const skip = Number(q.get('skip') ?? 0);
      return {
        state: 'ok', id: q.get('id'), files: ['data/use_case.jsonl', 'data/use_case_actor.jsonl'],
        uncommitted: skip ? [] : [{ table: 'use_case', key: 'P-D-UC01', change: 'changed', fields: [{ name: 'title', before: 'Lend', after: 'Lend a thing' }] }],
        commits: skip ? [commit(21)] : Array.from({ length: 20 }, (_, i) => commit(i + 1)), more: !skip,
      };
    });
    // Show the view again, so its request goes to these answers; it asks by the record's ID.
    fireEvent.click(switcher().getByRole('button', { name: 'Details' }));
    fireEvent.click(switcher().getByRole('button', { name: 'History' }));
    const list = await side().findByRole('list', { name: 'Commits that changed P-D-UC01' });
    expect(side().getByText('data/use_case.jsonl')).toBeInTheDocument();
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Not committed');
    expect(rows[0]).toHaveTextContent('title changed');
    expect(rows[1]).toHaveTextContent(/Change 1.*Owner.*0001aaa/);
    // Each commit says what it changed: the record's fields, and its parts by table.
    expect(rows[1]).toHaveTextContent('goal changed · use case actor: added');
    expect(rows).toHaveLength(21);
    expect(asked[0]).toBe('/api/history?id=P-D-UC01');
    expect(changeSummary(statement)).toBe('goal changed');

    // The uncommitted change's fields, inline, before and after.
    fireEvent.click(rows[0]);
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
    const working = await side().findByRole('region', { name: 'Uncommitted changes' });
    expect(working.querySelector('.history-before')).toHaveTextContent('Lend');
    expect(working.querySelector('.history-after')).toHaveTextContent('Lend a thing');
    // One open at a time.
    fireEvent.click(rows[1]);
    const first = await side().findByRole('region', { name: 'Changes in 0001aaa' });
    expect(within(first).getByRole('heading', { name: /The record/ })).toBeInTheDocument();
    expect(within(first).getByRole('heading', { name: /use case actor \(use_case_id P-D-UC01, position 1\)/ })).toBeInTheDocument();
    expect(side().queryByRole('region', { name: 'Uncommitted changes' })).toBeNull();
    // Every history request names the record; there is no second request per commit.
    expect(asked.every((u) => !u.includes('commit='))).toBe(true);

    fireEvent.click(side().getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(22));
    expect(side().queryByRole('button', { name: 'Load more' })).toBeNull();

    // No git: said calmly.
    serveHistory((q) => ({ state: 'no-repo', id: q.get('id'), files: ['data/use_case.jsonl'], message: 'The product folder is not a git repository, so its records have no history yet.' }));
    fireEvent.click(switcher().getByRole('button', { name: 'Details' }));
    fireEvent.click(switcher().getByRole('button', { name: 'History' }));
    expect(await side().findByText(/not a git repository/)).toBeInTheDocument();
  });

  it('LA-V95-R05-T02 On a phone the side bar is a bottom sheet with the same three views', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    const sheet = screen.getByRole('dialog', { name: 'Side bar' });
    expect(within(sheet).getByRole('group', { name: 'Side bar views' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Outline' }));
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Outline' })).toBeInTheDocument();
  });
});
