import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Workspace } from '../../lathe/src/types';
import { graphMap, mapRootOf } from '../src/graph/map';
import { indexWorkspace, spaceIndex } from '../src/specs/data';
import { workspace } from './fixtures/workspace';
import { main, openApp, openSideBar, sideBar } from './helpers';

// Each product is a separate space (brief 82): every view and count inside a space reads the
// space's own index, so nothing of another product shows in it, even where the specs link or cite
// across products (an error the link-crosses-product check reports).

/** The fixture with Demo shop's use case linking to and citing Notebook's domain, and a record of no product. */
function crossingWorkspace(): Workspace {
  const ws = workspace();
  ws.records = ws.records.map((r) => (r.id === 'DM-SHOP-UC01' ? { ...r, body: 'Like NF-NOTE, it keeps a list.', mentions: ['NF-NOTE'] } : r));
  ws.records.push({ id: 'ZZ-LOOSE', kind: 'use_case', title: 'A loose use case', parent: 'ZZ-GONE', product: null, domain: null, fields: {}, body: '', path: 'specs/zz.md', mentions: [] });
  ws.links.push({ source: 'DM-SHOP-UC01', relation: 'applies', target: 'NF-NOTE' });
  ws.problems.push({ severity: 'error', check: 'link-crosses-product', record: 'DM-SHOP-UC01', message: 'DM-SHOP-UC01 applies NF-NOTE, a record of NF, not of its own product DM.' });
  return ws;
}

describe('separate spaces', () => {
  it("LA-EXP-T178 A space's index holds only its product's records, links, mentions, coverage and problems, and the records and problems of no product", () => {
    const index = indexWorkspace(crossingWorkspace());
    const dm = spaceIndex(index, 'DM');
    expect(spaceIndex(index, 'DM')).toBe(dm);
    expect(dm.products.map((p) => p.id)).toEqual(['DM']);
    expect(dm.workspace.records.every((r) => r.product === 'DM' || r.product === null)).toBe(true);
    expect(dm.byId.has('ZZ-LOOSE')).toBe(true);
    expect(dm.byId.has('NF-NOTE')).toBe(false);
    expect(dm.workspace.links.some((l) => l.target === 'NF-NOTE' || l.source.startsWith('NF'))).toBe(false);
    expect(dm.byId.get('DM-SHOP-UC01')!.mentions).toEqual([]);
    expect(dm.workspace.coverage.map((c) => c.domain).sort()).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(dm.workspace.problems.map((p) => p.record)).not.toContain('NF-NOTE');
    expect(dm.workspace.problems.some((p) => p.record === null)).toBe(true);
    const nf = spaceIndex(index, 'NF');
    expect(nf.workspace.records.some((r) => r.product === 'DM')).toBe(false);
    expect(nf.workspace.problems.map((p) => p.record)).toEqual(expect.arrayContaining(['NF-NOTE', null]));
  });

  it('LA-EXP-T179 Each product has its own graph map with the product as its single root, and the graph shows nothing of another product', async () => {
    const index = indexWorkspace(crossingWorkspace());
    const dm = spaceIndex(index, 'DM');
    expect(mapRootOf(dm, 'DM-SHOP-UC01')).toBe('DM');
    const map = graphMap(dm, 'DM');
    expect(map.roots).toEqual(['DM']);
    expect([...map.nodes.keys()].every((id) => id.startsWith('DM'))).toBe(true);
    // A record no product reaches is the root of a map of its own.
    expect(mapRootOf(dm, 'ZZ-LOOSE')).toBe('ZZ-LOOSE');
    expect(graphMap(dm, 'ZZ-LOOSE').roots).toEqual(['ZZ-LOOSE']);

    // The Links switch on: the link into Notebook is not drawn.
    window.sessionStorage.setItem('lathe:graph-settings', JSON.stringify({ depth: 2, trace: false, hiddenKinds: [], hiddenRelations: [], links: true, minimap: true }));
    await openApp('/DM-SHOP-UC01?view=graph', { workspace: crossingWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="DM-SHOP-UC01"]')).not.toBeNull());
    const drawn = [...document.querySelectorAll('.react-flow__node[data-id]')].map((n) => n.getAttribute('data-id')!);
    expect(drawn.filter((id) => !id.startsWith('DM'))).toEqual([]);
  });

  it('LA-EXP-T180 No screen of one space shows another product: the side bar, prose, the format reference and Checks', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01', { workspace: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // The link into Notebook is not listed, and the citation is plain text, not a link.
    expect(within(sideBar()).queryByText(/NF-NOTE/)).toBeNull();
    expect(within(main()).getByText(/Like NF-NOTE, it keeps a list/)).toBeInTheDocument();
    expect(main().querySelector('a[href="/NF-NOTE"]')).toBeNull();
    // The format reference counts and lists the space's records only.
    await openApp('/format/kinds/domain', { workspace: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: /Domain/ });
    expect(main().querySelector('a[href="/NF-NOTE"]')).toBeNull();
    expect(within(main()).getByText(/^2 domains in Demo shop/)).toBeInTheDocument();
    // Notebook's Checks names nothing of Demo shop, even the link that crosses into Notebook.
    await openApp('/NF/checks', { workspace: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(main().textContent).not.toMatch(/DM-/);
  });

  it('LA-EXP-T181 The products page is the space chooser: each product with its name and domain count, nothing from inside it', async () => {
    await openApp('/', { workspace: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Products' });
    const cards = [...main().querySelectorAll<HTMLAnchorElement>('a.card')];
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/DM', '/NF']);
    expect(cards.map((c) => c.textContent)).toEqual(['DMDemo shop2 domains', 'NFNotebook1 domain']);
    expect(main().querySelector('.problem-badge, .coverage-bars, .problems')).toBeNull();
  });
});
