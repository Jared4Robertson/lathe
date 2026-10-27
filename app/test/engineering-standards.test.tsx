import './graph/setup';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { referenceFromWorkspace } from '../src/format/reference';
import { relationStyle } from '../src/graph/GraphPage';
import { neighborhood } from '../src/graph/model';
import { Legend } from '../src/graph/panel';
import { shapeOf } from '../src/graph/shapes';
import { indexWorkspace } from '../src/specs/data';
import { standardWorkspace } from './fixtures/standards';
import { main, openApp, section } from './helpers';

// Standards in the app (FORMAT.md section 19): under Shared in the nav beside the patterns, a standard's
// page listing its rules with what meets each one, a rule's Traceability showing Met by, the format
// reference's kind pages, and the graph's plain boxes and design lines.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;
const fact = (box: HTMLElement, name: string) => within(box).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
const served = () => ({ workspace: standardWorkspace(), format: referenceFromWorkspace(standardWorkspace()) });

describe('standards in the nav and the wiki', () => {
  it('LA-AUT-T125 The product lists its standards under Shared, beside its patterns', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const shared = list('Shared by Demo shop');
    expect(rows(shared)).toEqual(['Shared2']);
    await userEvent.setup().click(head(shared, /^Shared/));
    const folder = list('Shared of Demo shop');
    const links = within(folder).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/DM-PAT-CHECKOUT', '/DM-STD-CODE']);
    expect(within(list('Groups of Demo shop')).queryByRole('link', { name: /Shop code/ })).toBeNull();
  });

  it('LA-AUT-T126 A standard\'s page lists its rules with what meets each one', async () => {
    await openApp('/DM-STD-CODE', served());
    await screen.findByRole('heading', { level: 1, name: 'Shop code' });
    const rules = section(/^Rules/);
    const table = within(rules).getByRole('table', { name: 'The rules of DM-STD-CODE, with what meets each one' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Rule', 'Met by']);
    const row = (id: string) => within(table).getByRole('link', { name: new RegExp(`^${id}`) }).closest('tr')!;
    expect(within(row('DM-STD-CODE-R01')).getAllByRole('link').map((a) => a.textContent)).toEqual(['DM-STD-CODE-R01Errors carry a code', 'DM-SHOP-C01', 'DM-SHOP-T01']);
    expect(row('DM-STD-CODE-R02')).toHaveTextContent('Nothing yet');
  });

  it('LA-AUT-T127 A standard rule\'s Traceability shows Met by, and what meets it shows Meets', async () => {
    await openApp('/DM-STD-CODE-R01', served());
    await screen.findByRole('heading', { level: 1, name: 'Errors carry a code' });
    const trace = section(/^Traceability/);
    const metBy = within(trace).getByRole('heading', { name: /^Met by/ }).closest('section')!;
    expect(within(metBy).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-C01', '/DM-SHOP-T01']);
    // A standard rule owes nothing: no gaps are judged.
    expect(trace.querySelector('.trace-gaps')).toBeNull();

    await openApp('/DM-SHOP-C01', served());
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    const meets = within(section(/^Traceability/)).getByRole('heading', { name: /^Meets/ }).closest('section')!;
    expect(within(meets).getByRole('link', { name: /DM-STD-CODE-R01/ })).toHaveAttribute('href', '/DM-STD-CODE-R01');
  });

  it('LA-AUT-T128 The format reference has a page for each standard kind, from the meta-model', async () => {
    await openApp('/format/kinds/standard_rule', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Standard rule' })).toBeInTheDocument();
    const where = section('Where it sits');
    expect(fact(where, 'Stage')).toBe('Product level');
    expect(fact(where, 'Folder')).toMatch(/^Shared/);
    expect(within(section(/^Allowed parents/)).getByRole('link', { name: /standard/ })).toHaveAttribute('href', '/format/kinds/standard');
    const into = section(/^Links in/);
    expect(within(into).getAllByText('Met by').length).toBeGreaterThan(0);
    expect(within(into).getByRole('link', { name: /component/ })).toHaveAttribute('href', '/format/kinds/component');
    expect(within(main()).getByText('One rule of a standard.')).toBeInTheDocument();
  });
});

describe('standards in the graph', () => {
  it('LA-AUT-T129 The graph draws a standard as a pattern with a ruler in Shared and meets as a design line in its key', () => {
    const ix = indexWorkspace(standardWorkspace());
    const n = neighborhood(ix, 'DM-STD-CODE', 1);
    expect(n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`)).toEqual(expect.arrayContaining([
      // Shared holds two kinds, so the graph groups it by kind.
      'DM/shared/standard parent DM-STD-CODE',
      'DM-STD-CODE parent DM-STD-CODE-R01',
      'DM-STD-CODE parent DM-STD-CODE-R02',
    ]));
    expect(n.nodes.find((x) => x.id === 'DM-STD-CODE')?.stage).toBe('design');
    expect(relationStyle('meets')).toBe('design');
    cleanup();
    const { container } = render(<Legend />);
    expect(container.querySelector('.graph-swatch.stage-design')?.closest('li')).toHaveTextContent(/a standard and its rules/);
    expect(shapeOf('standard')).toEqual({ shape: 'stack', mark: 'ruler' });
    expect(shapeOf('standard_rule')).toEqual({ shape: 'octagon', mark: 'ruler' });
    expect(container.querySelector('.graph-swatch.shape-stack')?.closest('li')).toHaveTextContent(/a standard with a ruler/);
    expect(container.querySelector('.graph-swatch.mark-ruler')?.closest('li')).toHaveTextContent(/a standard or a standard rule/);
    expect(container.querySelector('.graph-line.rel-design')?.closest('li')).toHaveTextContent(/meets/);
  });
});
