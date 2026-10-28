import './graph/setup';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { relationStyle } from '../src/graph/GraphPage';
import { neighborhood } from '../src/graph/model';
import { Legend } from '../src/graph/panel';
import { shapeOf } from '../src/graph/shapes';
import { standardWorkspace } from './fixtures/standards';
import { main, openApp, section as pageSection } from './helpers';

/** A section of the wiki card, on a record's page (the side bar has a Traceability of its own), or of the page elsewhere. */
const section = (name: string | RegExp) => {
  const card = screen.queryByRole('region', { name: 'Wiki card' });
  return card ? within(card).getByRole('heading', { name }).closest('section') as HTMLElement : pageSection(name);
};
import { indexOf } from './fixtures/load';

// Standards in the app (the standard and standard_rule tables): in Shared in the nav, in the
// Technical specification stage, a standard's page listing its rules with what meets each one and its tests, a
// rule's Traceability showing what meets it and what proves it, the format reference's kind pages, and the graph's
// boxes and design lines. DM-STD-CODE-R01 is met by the command handler DM-SHOP-CMD01-H and proved by its standard
// rule test DM-STD-CODE-R01-T01; R02 is met by the table DM-SHOP-EN01-TB and has no test.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;
const fact = (box: HTMLElement, name: string) => within(box).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
const served = () => ({ data: standardWorkspace() });

describe('standards in the nav and the wiki', () => {
  it('LA-V92-R72-T01 The product lists its standards under Shared, beside its patterns', async () => {
    await openApp('/DM', served());
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(rows(list('Shared in Demo shop'))).toEqual(['Shared5']);
    const user = userEvent.setup();
    await user.click(head(list('Shared in Demo shop'), /^Shared/));
    const own = list('Stages of Demo shop');
    expect(rows(own)).toEqual(['Domain model1', 'Interaction design2', 'Technical specification1', 'Test plan1']);
    await user.click(head(own, /^Technical specification/));
    const stage = list('Technical specification of Demo shop');
    expect(rows(stage)).toEqual(['Standards1']);
    await user.click(head(stage, /^Standards/));
    expect(within(list('Standards of Demo shop')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-STD-CODE']);
  });

  it('LA-V92-R72-T02 A standard\'s page lists its rules with what meets each one and the tests that prove it', async () => {
    await openApp('/DM-STD-CODE', served());
    await screen.findByRole('heading', { level: 1, name: 'Code standard' });
    const rules = section(/^Rules/);
    const table = within(rules).getByRole('table', { name: 'The rules of DM-STD-CODE, with what meets each one and its tests' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Rule', 'Met by', 'Proved by']);
    const row = (id: string) => within(table).getByRole('link', { name: new RegExp(`^${id}(?!-)`) }).closest('tr')!;
    expect(within(row('DM-STD-CODE-R01')).getAllByRole('link').map((a) => a.textContent)).toEqual(['DM-STD-CODE-R01Handlers own their transaction', 'DM-SHOP-CMD01-H', 'DM-STD-CODE-R01-T01']);
    expect(within(row('DM-STD-CODE-R02')).getAllByRole('link').map((a) => a.textContent)).toEqual(['DM-STD-CODE-R02Tables have a primary key', 'DM-SHOP-EN01-TB']);
    expect(row('DM-STD-CODE-R02').querySelectorAll('td')[1]).toHaveTextContent('Nothing yet');
  });

  it('LA-V92-R73-T01 A standard rule\'s Traceability shows what meets it and its tests, and what meets it shows Meets', async () => {
    await openApp('/DM-STD-CODE-R01', served());
    await screen.findByRole('heading', { level: 1, name: 'Handlers own their transaction' });
    const trace = section(/^Traceability/);
    const metBy = within(trace).getByRole('heading', { name: /^Met by/ }).closest('section')!;
    expect(within(metBy).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-CMD01-H']);
    const provedBy = within(trace).getByRole('heading', { name: /^Proved by/ }).closest('section')!;
    expect(within(provedBy).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-STD-CODE-R01-T01']);

    await openApp('/DM-SHOP-CMD01-H', served());
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    const meets = within(section(/^Traceability/)).getByRole('heading', { name: /^Meets/ }).closest('section')!;
    expect(within(meets).getByRole('link', { name: /DM-STD-CODE-R01/ })).toHaveAttribute('href', '/DM-STD-CODE-R01');
  });

  it('LA-V92-R73-T02 The format reference has a page for each standard kind, from the schema', async () => {
    await openApp('/format/kinds/standard_rule', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Standard rule' })).toBeInTheDocument();
    const where = section('Where it sits');
    expect(fact(where, 'Stage')).toMatch(/^Technical specification/);
    expect(within(section(/^Allowed parents/)).getByRole('link', { name: /standard/ })).toHaveAttribute('href', '/format/kinds/standard');
    const into = section(/^Links in/);
    expect(within(into).getAllByText('Met by').length).toBeGreaterThan(0);
    expect(within(into).getByRole('link', { name: /command_handler/ })).toHaveAttribute('href', '/format/kinds/command_handler');
    expect(within(main()).getByText(/^One rule of a standard\./)).toBeInTheDocument();
  });
});

describe('standards in the graph', () => {
  it('LA-V93-R71-T01 The graph draws a standard as stacked boxes with a ruler in the product\'s Technical specification, and meets as a design line in its key', () => {
    const ix = indexOf(standardWorkspace());
    const n = neighborhood(ix, 'DM-STD-CODE', 1);
    expect(n.edges.map((e) => `${e.source} ${e.relation} ${e.target}`)).toEqual(expect.arrayContaining([
      'DM/technical-specification/standard parent DM-STD-CODE',
      'DM-STD-CODE parent DM-STD-CODE-R01',
      'DM-STD-CODE parent DM-STD-CODE-R02',
    ]));
    expect(n.nodes.find((x) => x.id === 'DM-STD-CODE')?.stage).toBe('technical-specification');
    expect(relationStyle('meets')).toBe('design');
    cleanup();
    const { container } = render(<Legend />);
    expect(container.querySelector('.graph-swatch.stage-technical-specification')?.closest('li')).toHaveTextContent(/a standard and its rules/);
    expect(shapeOf('standard')).toEqual({ shape: 'stack', mark: 'ruler' });
    expect(shapeOf('standard_rule')).toEqual({ shape: 'octagon', mark: 'ruler' });
    expect(container.querySelector('.graph-swatch.shape-stack')?.closest('li')).toHaveTextContent(/a standard with a ruler/);
    expect(container.querySelector('.graph-swatch.mark-ruler')?.closest('li')).toHaveTextContent(/a standard or a standard rule/);
    expect(container.querySelector('.graph-line.rel-design')?.closest('li')).toHaveTextContent(/meets/);
  });
});
