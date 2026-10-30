import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { neighborhood } from '../src/graph/model';
import { linkMentions, renderMarkdown } from '../src/specs/Markdown';
import { proseLinks } from '../src/specs/mentions';
import { patternWorkspace } from './fixtures/patterns';
import { facts, openApp } from './helpers';
import { indexOf, setRow } from './fixtures/load';

// Record IDs named in a text field become links: every ID-shaped token that is a record of the
// space (other than the record itself), wherever it appears in the text but never inside code with
// other text; an ID that is no record stays plain text.

const links = (titles: Record<string, string>) => ({
  titles: new Map(Object.entries(titles)),
  href: (id: string) => `/${id}` });
const body = () => document.querySelector('.record-main .markdown, .spec-body .markdown') as HTMLElement;

/**
 * The pattern workspace with text that names records: DM-SHOP-UC01's goal names the pattern, an
 * invariant (in text and as code) and an ID that is no record; DM-PAY-UC01's names DM-SHOP-UC01 next to
 * one of its UC requirements' IDs.
 */
function withText() {
  const ws = patternWorkspace();
  setRow(ws, 'use_case', 'DM-SHOP-UC01', { goal: 'A shopper adds an item, as DM-PAT-AUDIT asks and DM-SHOP-INV01 limits (`DM-SHOP-INV01`). It once cited DM-SHOP-INV99.' });
  setRow(ws, 'use_case', 'DM-PAY-UC01', { goal: 'Follows DM-SHOP-UC01, whose DM-SHOP-UC01-R01 must hold.' });
  return ws;
}

describe('record IDs in text fields', () => {
  it('LA-PAT-RECORD-PAGE-R13-T01 Every mentioned ID in the text becomes a link to its record, with its title on hover', () => {
    const html = renderMarkdown('See TL-LEND-DR01, and again TL-LEND-DR01.\n\n- In a list: TL-LEND-UC01', links({ 'TL-LEND-DR01': 'One loan at a time', 'TL-LEND-UC01': 'Lend a tool' }));
    const div = document.createElement('div');
    div.innerHTML = html;
    const anchors = [...div.querySelectorAll('a.mention')];
    expect(anchors.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('title')])).toEqual([
      ['TL-LEND-DR01', '/TL-LEND-DR01', 'One loan at a time'],
      ['TL-LEND-DR01', '/TL-LEND-DR01', 'One loan at a time'],
      ['TL-LEND-UC01', '/TL-LEND-UC01', 'Lend a tool'],
    ]);
    expect(div.textContent).toContain('See TL-LEND-DR01, and again TL-LEND-DR01.');
  });

  const proveLaV92R18T02 = () => {
    const html = renderMarkdown(
      'Code `see TL-LEND-DR01` and\n\n```\nTL-LEND-DR01\n```\n\n[a link to TL-LEND-DR01](https://example.com) and TL-LEND-DR01-R01 and XTL-LEND-DR01.',
      links({ 'TL-LEND-DR01': 'One loan at a time' }),
    );
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelectorAll('a.mention')).toHaveLength(0);
    expect(div.querySelector('code')!.textContent).toBe('see TL-LEND-DR01');
    // A code span holding one lone ID is how writers format IDs, so it links, keeping its code style.
    const lone = document.createElement('div');
    lone.innerHTML = renderMarkdown('Rule `TL-LEND-DR01` applies.', links({ 'TL-LEND-DR01': 'One loan at a time' }));
    const a = lone.querySelector('a.mention')!;
    expect(a.getAttribute('href')).toBe('/TL-LEND-DR01');
    expect(a.querySelector('code')!.textContent).toBe('TL-LEND-DR01');
    // Nothing to link leaves the HTML as it was.
    expect(linkMentions('<p>TL-LEND-DR01</p>', links({}))).toBe('<p>TL-LEND-DR01</p>');
  };
  it('LA-PAT-RECORD-PAGE-R13-T01 IDs inside code blocks, code with other text, links and longer IDs are never linked; a code span of one lone ID is', proveLaV92R18T02);
  it('LA-PAT-RECORD-PAGE-R05-T01 IDs in code blocks, code with other text, links and longer IDs are not linked; a lone-ID code span is', proveLaV92R18T02);

  const proveLaV92R18T03 = () => {
    const ix = recordIndexOf(withText());
    const uc = ix.byId.get('DM-SHOP-UC01')!;
    const p = proseLinks(ix, `${String(uc.row.goal)} See DM-SHOP-UC01.`, uc.id);
    expect([...p.titles]).toEqual([['DM-PAT-AUDIT', 'Audited action'], ['DM-SHOP-INV01', 'A basket holds at most 50 items']]);
  };
  it('LA-PAT-RECORD-PAGE-R13-T01 Only the IDs of records are linked, never the record itself; an ID that is no record is not', proveLaV92R18T03);
  it('LA-PAT-RECORD-PAGE-R14-T01 Only the IDs of records are linked, never the record itself', proveLaV92R18T03);

  const proveLaV92R18T04 = async () => {
    await openApp('/DM-SHOP-UC01', { data: withText() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const prose = within(body());
    // The goal names DM-SHOP-INV01 twice: in the text, and as code holding just that ID.
    expect(prose.getAllByRole('link').map((a) => a.textContent)).toEqual(['DM-PAT-AUDIT', 'DM-SHOP-INV01', 'DM-SHOP-INV01']);
    // DM-SHOP-INV99 is no record: it stays plain text.
    expect(body()).toHaveTextContent('It once cited DM-SHOP-INV99.');
    expect(body().querySelector('.mention:not(a)')).toBeNull();
    // The ID in code keeps its code style inside the link.
    expect(body().querySelector('a.mention code')!.textContent).toBe('DM-SHOP-INV01');
    fireEvent.click(prose.getAllByRole('link', { name: 'DM-SHOP-INV01' })[0]);
    expect(window.location.pathname).toBe('/DM-SHOP-INV01');
    await screen.findByRole('heading', { level: 1, name: 'A basket holds at most 50 items' });
  };
  it('LA-PAT-RECORD-PAGE-R13-T01 On a record page a text field links the records it names, leaves an unknown ID as text, and a link moves within the app', proveLaV92R18T04);
  it('LA-PAT-RECORD-PAGE-R14-T01 On a record page a text field links the records it names, and a link moves within the app', proveLaV92R18T04);

  const proveLaV92R18T05 = async () => {
    await openApp('/DM-PAY-UC01', { data: withText() });
    await screen.findByRole('heading', { level: 1, name: 'Pay by card' });
    expect(within(body()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('title')])).toEqual([
      ['DM-SHOP-UC01', 'Add an item to the basket'],
      ['DM-SHOP-UC01-R01', 'The basket shows the new item'],
    ]);
    // A mention is not a link between records: not in the links out among its facts, not in the graph.
    expect(within(facts()).getByRole('heading', { name: 'Links out' })).toBeInTheDocument();
    expect(within(facts()).queryByRole('link', { name: /^DM-SHOP-UC01/ })).toBeNull();
    const ix = recordIndexOf(withText());
    expect(neighborhood(ix, 'DM-PAY-UC01', 2).nodes.map((n) => n.id)).not.toContain('DM-SHOP-UC01');

    const ws = setRow(withText(), 'domain', 'DM-SHOP', { description: 'Shopping starts at DM-SHOP-UC01.' });
    await openApp('/DM-SHOP', { data: ws });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    await waitFor(() => expect(document.querySelector('.spec-body .record-lead a.mention')).toHaveAttribute('href', '/DM-SHOP-UC01'));
  };
  it('LA-PAT-RECORD-PAGE-R13-T01 An ID inside a longer ID links only as the longer one, a named record is not a link between records, and domain pages link theirs too', proveLaV92R18T05);
  it('LA-PAT-RECORD-PAGE-R04-T01 An ID inside a longer ID links only as the longer one, and domain pages link theirs too', proveLaV92R18T05);
});
