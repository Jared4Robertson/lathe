import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { neighborhood } from '../src/graph/model';
import { indexWorkspace } from '../src/specs/data';
import { linkMentions, renderMarkdown } from '../src/specs/Markdown';
import { proseLinks } from '../src/specs/mentions';
import { patternWorkspace } from './fixtures/patterns';
import { openApp, openSideBar } from './helpers';

// Record IDs cited in prose become links (FORMAT.md section 11): every ID in the record's
// `mentions`, wherever it appears in the text but never inside code; unknown IDs that the engine
// warned about look like broken links.

const links = (titles: Record<string, string>, broken: string[] = []) => ({
  titles: new Map(Object.entries(titles)),
  broken: new Set(broken),
  href: (id: string) => `/${id}`,
});
const body = () => document.querySelector('.record-main .markdown, .spec-body .markdown') as HTMLElement;

describe('prose mentions', () => {
  it('LA-EXP-T53 Every mentioned ID in the text becomes a link to its record, with its title on hover', () => {
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

  it('LA-EXP-T54 IDs inside code blocks, code with other text, links and longer IDs are never linked; a code span of one lone ID is', () => {
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
  });

  it('LA-EXP-T55 Only the record\'s own mentions are linked; unknown IDs it was warned about look broken', () => {
    const ix = indexWorkspace(patternWorkspace());
    const uc = ix.byId.get('DM-SHOP-UC01')!;
    const p = proseLinks(ix, uc);
    expect([...p.titles]).toEqual([['DM-PAT-CHECKOUT', 'Checkout step'], ['DM-SHOP-DR01', 'A basket holds at most 50 items']]);
    expect([...p.broken]).toEqual(['DM-SHOP-DR99']);
  });

  it('LA-EXP-T56 On a record page the body links its mentions, marks unknown IDs, and a link moves within the app', async () => {
    await openApp('/DM-SHOP-UC01', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const prose = within(body());
    // The body cites DM-SHOP-DR01 twice: in the text, and as code holding just that ID.
    expect(prose.getAllByRole('link').map((a) => a.textContent)).toEqual(['DM-PAT-CHECKOUT', 'DM-SHOP-DR01', 'DM-SHOP-DR01']);
    expect(prose.getByText('DM-SHOP-DR99')).toHaveClass('mention', 'broken');
    expect(prose.getByText('DM-SHOP-DR99')).toHaveAttribute('title', 'No record has the ID DM-SHOP-DR99');
    // The ID in code keeps its code style inside the link.
    expect(body().querySelector('a.mention code')!.textContent).toBe('DM-SHOP-DR01');
    fireEvent.click(prose.getAllByRole('link', { name: 'DM-SHOP-DR01' })[0]);
    expect(window.location.pathname).toBe('/DM-SHOP-DR01');
    await screen.findByRole('heading', { level: 1, name: 'A basket holds at most 50 items' });
  });

  it('LA-EXP-T57 A mention next to a longer ID links only the ID mentioned, is not a link between records, and domain pages link theirs too', async () => {
    openSideBar();
    await openApp('/DM-PAY-UC01', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Pay by card' });
    expect(within(body()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('title')])).toEqual([['DM-SHOP-UC01', 'Add an item to the basket']]);
    expect(body()).toHaveTextContent('DM-SHOP-UC01-R01 is not cited here');
    // A mention is not a link between records: not in the links out, not in the graph.
    expect(within(screen.getByRole('complementary', { name: 'Side bar' })).queryByRole('link', { name: /^DM-SHOP-UC01/ })).toBeNull();
    const ix = indexWorkspace(patternWorkspace());
    expect(neighborhood(ix, 'DM-PAY-UC01', 2).nodes.map((n) => n.id)).not.toContain('DM-SHOP-UC01');

    const ws = patternWorkspace();
    const domain = ws.records.find((r) => r.id === 'DM-SHOP')!;
    domain.body = 'Shopping starts at DM-SHOP-UC01.';
    domain.mentions = ['DM-SHOP-UC01'];
    await openApp('/DM-SHOP', { workspace: ws });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    await waitFor(() => expect(document.querySelector('.spec-body > .markdown a.mention')).toHaveAttribute('href', '/DM-SHOP-UC01'));
  });
});
