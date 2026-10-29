import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SpecData } from '../../lathe/src/server/contract';
import { graphMap, mapRootOf } from '../src/graph/map';
import { spaceIndex } from '../src/specs/data';
import { addRows, indexOf, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, openSideBar, sideBar } from './helpers';
import { boxElement, drawnIds } from './graph/scene';

// Each product is a separate space: every view and count inside a space reads the
// space's own index, so nothing of another product shows in it, even where the data names or links
// across products (which the store refuses, but the app does not rely on that).

/** The fixture with Demo shop's use case linking to and naming Notebook's domain, and a record of no product. */
function crossingWorkspace(): SpecData {
  const ws = setRow(workspace(), 'use_case', 'DM-SHOP-UC01', { goal: 'Like NF-NOTE, it keeps a list.' });
  addRows(ws, 'use_case', { id: 'ZZ-LOOSE', title: 'A loose use case', capability_id: 'ZZ-GONE' });
  addRows(ws, 'follows', { source_id: 'DM-SHOP-UC01', target_id: 'NF-NOTE' });
  ws.problems.push({ severity: 'error', check: 'link-crosses-product', record: 'DM-SHOP-UC01', message: 'DM-SHOP-UC01 follows NF-NOTE, a record of NF, not of its own product DM.' });
  return ws;
}

describe('separate spaces', () => {
  const proveLaExpSp01T = () => {
    const index = indexOf(crossingWorkspace());
    const dm = spaceIndex(index, 'DM');
    expect(spaceIndex(index, 'DM')).toBe(dm);
    expect(dm.products.map((p) => p.id)).toEqual(['DM']);
    expect(dm.workspace.records.every((r) => r.product === 'DM' || r.product === null)).toBe(true);
    expect(dm.byId.has('ZZ-LOOSE')).toBe(true);
    expect(dm.byId.has('NF-NOTE')).toBe(false);
    expect(dm.workspace.links.some((l) => l.target === 'NF-NOTE' || l.source.startsWith('NF'))).toBe(false);
    expect(dm.workspace.coverage.map((c) => c.domain ?? c.product).sort()).toEqual(['DM', 'DM-PAY', 'DM-SHOP']);
    expect(dm.workspace.problems.map((p) => p.record)).not.toContain('NF-NOTE');
    expect(dm.workspace.problems.some((p) => p.record === null)).toBe(true);
    const nf = spaceIndex(index, 'NF');
    expect(nf.workspace.records.some((r) => r.product === 'DM')).toBe(false);
    expect(nf.workspace.problems.map((p) => p.record)).toEqual(expect.arrayContaining(['NF-NOTE', null]));
  };
  it("LA-EXP-SP01-T A space's index holds only its product's records, links, parts, coverage and problems, and the records and problems of no product", proveLaExpSp01T);
  it("LA-V90-R15-T01 A space's index holds only its product's records, links, parts, coverage and problems", proveLaExpSp01T);

  const proveLaExpDs05T14 = async () => {
    const index = indexOf(crossingWorkspace());
    const dm = spaceIndex(index, 'DM');
    expect(mapRootOf(dm, 'DM-SHOP-UC01')).toBe('DM');
    const map = graphMap(dm, 'DM');
    expect(map.roots).toEqual(['DM']);
    expect([...map.nodes.keys()].every((id) => id.startsWith('DM'))).toBe(true);
    // A record no product reaches is the root of a map of its own.
    expect(mapRootOf(dm, 'ZZ-LOOSE')).toBe('ZZ-LOOSE');
    expect(graphMap(dm, 'ZZ-LOOSE').roots).toEqual(['ZZ-LOOSE']);

    // The Links switch on: the link into Notebook is not drawn.
    window.sessionStorage.setItem('lathe:session-settings', JSON.stringify({ layout: 'tree', depth: 2, hiddenKinds: [], minimap: true, card: true, cardWidth: null, cardExpanded: true, chat: false, chatWidth: null }));
    await openApp('/DM-SHOP-UC01?stage=graph', { data: crossingWorkspace() });
    await waitFor(() => expect(boxElement('DM-SHOP-UC01')).not.toBeNull());
    const drawn = drawnIds();
    expect(drawn.filter((id) => !id.startsWith('DM'))).toEqual([]);
  };
  it('LA-EXP-DS05-T14 Each product has its own graph map with the product as its single root, and the graph shows nothing of another product', proveLaExpDs05T14);
  it('LA-V90-R15-T02 Each product has its own graph map, showing nothing of another product', proveLaExpDs05T14);

  it('LA-V90-R15-T03 No screen of one space shows another product: the side bar, text, the format reference and Checks', async () => {
    openSideBar();
    await openApp('/DM-SHOP-UC01', { data: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // The link into Notebook is not listed, and the ID in the text is plain text, not a link.
    expect(sideBar().querySelector('a[href="/NF-NOTE"]')).toBeNull();
    expect(within(main()).getByText(/Like NF-NOTE, it keeps a list/, { selector: 'p' })).toBeInTheDocument();
    expect(main().querySelector('a[href="/NF-NOTE"]')).toBeNull();
    // The format reference counts and lists the space's records only.
    await openApp('/format/kinds/domain', { data: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: /Domain/ });
    expect(main().querySelector('a[href="/NF-NOTE"]')).toBeNull();
    expect(within(main()).getByText(/^2 domains in Demo shop/)).toBeInTheDocument();
    // Notebook's Checks names nothing of Demo shop, even the link that crosses into Notebook.
    await openApp('/NF/checks', { data: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(main().textContent).not.toMatch(/DM-/);
  });

  it('LA-V97-R01-T01 The products page is the space chooser: each product with its name and domain count, nothing from inside it', async () => {
    await openApp('/', { data: crossingWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Products' });
    const cards = [...screen.getByRole('list', { name: 'Products' }).querySelectorAll<HTMLElement>(':scope > .card')];
    expect(cards.map((c) => c.querySelector('.card-title')?.getAttribute('href'))).toEqual(['/DM', '/NF']);
    expect(cards.map((c) => c.textContent)).toEqual(['DMDemo shop2 domains', 'NFNotebook1 domain']);
    expect(main().querySelector('.problem-badge, .coverage-bars, .problems')).toBeNull();
  });
});
