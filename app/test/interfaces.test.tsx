import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { main, openApp, section } from './helpers';
import { addRows } from './fixtures/load';
import { patternWorkspace } from './fixtures/patterns';

// A use case has one flow, the same through every interface that offers it; a step only one interface does is a
// variant. Its page lists its flow and the interfaces that offer it; the flow's page has a tab per offering interface
// with that interface's derived version; an interface lists its roles, its patterns, the use cases it offers and the
// rest. The Demo shop offers both use cases through its web app (DM-IF01), whose basket page (DM-V01) presents Add
// item; here it gains a CLI (DM-IF02) used by the Clerk and the Shopper, following the audit pattern (whose rules say
// how it carries out a step), that offers only the basket use case, and a step only the web app does.
const served = () => {
  const data = patternWorkspace();
  addRows(data, 'interface', { id: 'DM-IF02', title: 'Terminal', product_id: 'DM', kind: 'CLI', description: 'A terminal.', public: false });
  addRows(data, 'offers', { source_id: 'DM-IF02', target_id: 'DM-SHOP-UC01' });
  addRows(data, 'interface_actor', { interface_id: 'DM-IF02', position: 1, role_name: 'Clerk' }, { interface_id: 'DM-IF02', position: 2, role_name: 'Shopper' });
  addRows(data, 'follows', { source_id: 'DM-IF02', target_id: 'DM-PAT-AUDIT' });
  addRows(data, 'flow_step', { id: 'DM-SHOP-UC01-FL-S04', title: 'Shopper drags the item onto the basket', flow_id: 'DM-SHOP-UC01-FL', path: 'main', position: 3, interface_id: 'DM-IF01' });
  return { data };
};

const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').filter((r) => r.classList.contains('flow-step'));

describe('a flow through its interfaces', () => {
  it('LA-V101-R11-T01 A use case lists its flow and the interfaces that offer it', async () => {
    await openApp(`${addressOf('DM-SHOP-UC01')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const flow = section(/^Flow\s*1/);
    expect(within(within(flow).getByRole('list', { name: 'Flow of DM-SHOP-UC01' })).getByRole('link', { name: /DM-SHOP-UC01-FL/ })).toHaveAttribute('href', addressOf('DM-SHOP-UC01-FL'));
    const offering = within(flow).getByRole('list', { name: 'Interfaces that offer DM-SHOP-UC01' });
    // Each interface by ID, with its kind when its name does not say it (from the Product aggregate's list).
    await waitFor(() => expect(within(offering).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['DM-IF01Web app', 'DM-IF02TerminalCLI']));
  });

  it('LA-V101-R12-T01 A flow\'s page has a tab per offering interface with its derived version', async () => {
    await openApp(`${addressOf('DM-SHOP-UC01-FL')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const user = userEvent.setup();
    const tablist = within(main()).getByRole('tablist', { name: 'Interfaces of DM-SHOP-UC01-FL' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['All interfaces', 'Web app', 'Terminal']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);

    // All interfaces: the flow as written, a variant marked with its interface.
    const written = within(main()).getByRole('tabpanel');
    expect(written).toHaveAttribute('aria-labelledby', tabs[0].id);
    const variant = rowsOf(within(written).getAllByRole('table')[0]).find((r) => r.dataset.step === 'DM-SHOP-UC01-FL-S04')!;
    expect(variant).toHaveTextContent('Only in Web app');

    // The web app's version: its actor, every step (its own variant too), each carried out in the views that present
    // what it invokes; a step whose query no view presents is a gap.
    await user.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    let panel = within(main()).getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tabs[1].id);
    expect(within(panel).getByText('Actor').nextElementSibling).toHaveTextContent('Shopper');
    let [mainPath, refused] = within(panel).getAllByRole('table');
    expect(rowsOf(mainPath).map((r) => r.dataset.step)).toEqual(['DM-SHOP-UC01-FL-S01', 'DM-SHOP-UC01-FL-S02', 'DM-SHOP-UC01-FL-S04']);
    expect(within(rowsOf(mainPath)[0]).getByRole('list', { name: 'DM-SHOP-UC01-FL-S01 is carried out in' })).toHaveTextContent('DM-V01');
    expect(within(rowsOf(mainPath)[0]).getByRole('link', { name: 'DM-V01' })).toHaveAttribute('href', addressOf('DM-V01'));
    expect(rowsOf(mainPath)[1]).toHaveClass('is-gap');
    expect(rowsOf(mainPath)[1]).toHaveTextContent('Gap · Web app cannot reach DM-SHOP-QRY01');
    expect(rowsOf(refused).map((r) => r.dataset.step)).toEqual(['DM-SHOP-UC01-FL-S03']);
    expect(within(panel).getByText(/No pattern Web app follows says how it reaches a step or shows a refusal/)).toBeInTheDocument();

    // The arrow keys move between the tabs: the terminal's version leaves out the web app's variant, has the first of
    // the use case's actors it lists, and the rules of the pattern it follows.
    await user.keyboard('{ArrowRight}');
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    panel = within(main()).getByRole('tabpanel');
    expect(within(panel).getByText('Actor').nextElementSibling).toHaveTextContent('Shopper');
    [mainPath, refused] = within(panel).getAllByRole('table');
    expect(rowsOf(mainPath).map((r) => r.dataset.step)).toEqual(['DM-SHOP-UC01-FL-S01', 'DM-SHOP-UC01-FL-S02']);
    expect(rowsOf(mainPath)[0]).toHaveTextContent('Gap · Terminal cannot reach DM-SHOP-CMD01');
    expect(within(panel).getByRole('list', { name: 'Rules of the patterns DM-IF02 follows' })).toHaveTextContent('DM-PAT-AUDIT-R03');
    // The interface tabs are read only: the flow is edited as written.
    expect(within(panel).queryByRole('button', { name: /Expand/ })).toBeNull();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('LA-V51-R09-T01 An interface lists its roles, patterns, the use cases it offers by capability and the ones it does not', async () => {
    await openApp(`${addressOf('DM-IF02')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Terminal' });
    expect(within(main()).getByText('Roles').nextElementSibling).toHaveTextContent('Clerk, Shopper');
    expect(within(main()).getByText('Patterns').nextElementSibling!.querySelector('a')).toHaveAttribute('href', addressOf('DM-PAT-AUDIT'));
    const offers = section(/^Use cases it offers/);
    expect(within(offers).getByRole('heading', { level: 3, name: /^Buying/ })).toBeInTheDocument();
    expect(within(offers).queryByRole('heading', { level: 3, name: /^Paying/ })).toBeNull();
    const rows = within(within(offers).getByRole('list', { name: 'Use cases DM-IF02 offers: Buying' })).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('a')!.getAttribute('href'))).toEqual([addressOf('DM-SHOP-UC01')]);
    const missing = section(/^Use cases it does not offer/);
    const without = within(within(missing).getByRole('list', { name: 'Use cases DM-IF02 does not offer: Paying' })).getAllByRole('listitem');
    expect(without.map((r) => r.textContent)).toEqual(['DM-PAY-UC01Pay by card']);
    expect(within(missing).queryByRole('heading', { level: 3, name: /^Buying/ })).toBeNull();

    // The web app offers every use case, and names no role.
    await openApp(`${addressOf('DM-IF01')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Web app' });
    expect(within(section(/^Use cases it does not offer/)).getByText('It offers every use case of the product.')).toBeInTheDocument();
    expect(within(main()).getByText('Roles').nextElementSibling).toHaveTextContent('None named');
  });
});
