import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { traceChain, TRACE_COLUMNS } from '../src/graph/model';
import { RecordContent } from '../src/specs/RecordContent';
import { indexWorkspace } from '../src/specs/data';
import { domainFolders } from '../src/specs/folders';
import { apisWorkspace } from './fixtures/apis-and-design-flows';

// APIs, integrations and technical flows in the app (FORMAT.md sections 21 and 22): their pages,
// their folders, and a technical step in a trace.

const index = () => indexWorkspace(apisWorkspace());
const sectionOf = (name: RegExp) => screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
const linkIds = (el: HTMLElement) => [...el.querySelectorAll('a')].map((a) => a.textContent);

describe('APIs and integrations', () => {
  it("LA-EXP-T195 An API's page lists its endpoints, with their method and route, and the requirements they share", () => {
    render(<RecordContent index={index()} id="DM-SHOP-API01" onNavigate={vi.fn()} side={false} />);
    const endpoints = sectionOf(/^Endpoints/);
    expect(endpoints.querySelector('h2')).toHaveTextContent('Endpoints1');
    expect(within(endpoints).getByRole('link', { name: /DM-SHOP-E01/ })).toHaveAttribute('href', '/DM-SHOP-E01');
    expect(endpoints).toHaveTextContent('POST · /basket/items');
    const shared = sectionOf(/^Shared requirements/);
    expect(shared.querySelector('h2')).toHaveTextContent('Shared requirements1');
    expect(within(shared).getByRole('link', { name: /DM-SHOP-API01-R01/ })).toBeInTheDocument();
    // The sections replace the plain list of children.
    expect(screen.queryByRole('heading', { level: 2, name: /^Children/ })).toBeNull();
  });

  it("LA-EXP-T196 An integration's page lists its exchanges and names the outside system", () => {
    render(<RecordContent index={index()} id="DM-SHOP-INT01" onNavigate={vi.fn()} side={false} />);
    const exchanges = sectionOf(/^Exchanges/);
    expect(exchanges.querySelector('h2')).toHaveTextContent('Exchanges1');
    expect(exchanges).toHaveTextContent('What the domain exchanges with Card provider');
    expect(within(exchanges).getByRole('link', { name: /DM-SHOP-INT01-R01/ })).toBeInTheDocument();
  });
});

describe('technical flows', () => {
  it("LA-EXP-T197 A technical flow reads as a step table per path, with each step's component and what it satisfies", async () => {
    render(<RecordContent index={index()} id="DM-SHOP-DF01" onNavigate={vi.fn()} />);
    const steps = sectionOf(/^Steps/);
    expect(steps.querySelector('h2')).toHaveTextContent('Steps3');
    expect([...steps.querySelectorAll('h3')].map((h) => h.firstChild?.textContent)).toEqual(['Main path', 'Refused path']);
    const [main, refused] = within(steps).getAllByRole('table');
    expect(within(main).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Step', 'What happens', 'Component', 'Satisfies']);
    const rows = [...main.querySelectorAll('tbody tr.flow-step')] as HTMLElement[];
    expect(rows.map((r) => r.dataset.step)).toEqual(['DM-SHOP-DF01-S01', 'DM-SHOP-DF01-S02']);
    const cells = [...rows[0].querySelectorAll('th, td')] as HTMLElement[];
    expect(linkIds(cells[2])).toEqual(['DM-SHOP-C01']);
    expect(linkIds(cells[3])).toEqual(['DM-SHOP-DR01', 'DM-SHOP-UC01-R01']);
    expect([...refused.querySelectorAll('tbody tr.flow-step')].map((r) => (r as HTMLElement).dataset.step)).toEqual(['DM-SHOP-DF01-S03']);
    // Its transaction, locks and statements are folded under the row, with its body.
    const user = userEvent.setup();
    await user.click(within(main).getByRole('button', { name: 'Expand DM-SHOP-DF01-S01' }));
    const details = within(main).getByRole('region', { name: 'Details of DM-SHOP-DF01-S01' });
    expect(within(details).getByText('first').tagName).toBe('STRONG');
    expect([...details.querySelectorAll('.step-fields dt')].map((d) => d.textContent)).toEqual(['transaction', 'locks', 'statements']);
    expect(details).toHaveTextContent('the basket row');
  });

  it('LA-EXP-T198 An API and an integration sit in Interaction design, and a technical flow in Technical specification under its layer', () => {
    const { stages } = domainFolders(index(), 'DM-SHOP');
    const folder = (section: string) => stages.flatMap((s) => s.folders).find((f) => f.section === section)!;
    const interaction = folder('interaction-design');
    expect(interaction.kinds).toEqual(expect.arrayContaining(['api', 'integration']));
    expect(interaction.records.map((r) => r.id)).toEqual(expect.arrayContaining(['DM-SHOP-API01', 'DM-SHOP-INT01']));
    const technical = folder('technical-specification');
    expect(technical.kinds).toEqual(expect.arrayContaining(['design_flow', 'design_step']));
    const services = technical.groups.find((g) => g.record?.id === 'DM-SHOP-LAY01')!;
    expect(services.records.map((r) => r.id)).toEqual(['DM-SHOP-C01', 'DM-SHOP-DF01']);
  });

  it('LA-EXP-T199 In a trace, a technical step that satisfies the rule brings its technical flow and the component it uses', () => {
    const chain = traceChain(index(), 'DM-SHOP-DR01');
    const ids = chain.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['DM-SHOP-DF01-S01', 'DM-SHOP-DF01', 'DM-SHOP-C01']));
    expect(chain.edges.map((e) => `${e.source} ${e.relation} ${e.target}`)).toEqual(expect.arrayContaining([
      'DM-SHOP-DF01-S01 satisfies DM-SHOP-DR01', 'DM-SHOP-DF01 parent DM-SHOP-DF01-S01', 'DM-SHOP-DF01-S01 uses DM-SHOP-C01',
    ]));
    const column = new Map(chain.nodes.map((n) => [n.id, n.column]));
    expect(column.get('DM-SHOP-DF01-S01')).toBe(TRACE_COLUMNS.design_step);
    expect(column.get('DM-SHOP-DF01-S01')!).toBeLessThan(column.get('DM-SHOP-C01')!);
  });
});
