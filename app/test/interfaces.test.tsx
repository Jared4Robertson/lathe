import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { openApp, section } from './helpers';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';

// A use case happens through one or more of its product's interfaces, with one flow for each: its page lists them by
// interface, a flow names its interface, and an interface lists its flows by capability and the use cases with no
// flow through it. The workspace's Demo shop goes through its web app (DM-IF01); here it gains a CLI (DM-IF02) that
// only the basket use case has a flow through.
const served = () => {
  const data = workspace();
  addRows(data, 'interface', { id: 'DM-IF02', title: 'Terminal', product_id: 'DM', kind: 'CLI' });
  addRows(data, 'flow', { id: 'DM-SHOP-UC01-FL02', title: 'Add an item to the basket through the terminal', use_case_id: 'DM-SHOP-UC01', interface_id: 'DM-IF02' });
  return { data };
};

describe('flows by interface', () => {
  it('LA-V101-R11-T01 A use case lists its flows by interface, and a flow names its interface', async () => {
    await openApp(`${addressOf('DM-SHOP-UC01')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const rows = within(within(section(/^Flows by interface/)).getByRole('list', { name: 'Flows of DM-SHOP-UC01' })).getAllByRole('listitem');
    // One row per flow, a whole-row link, with its interface's name, and its kind when the name does not say it (from
    // the Product aggregate's list of interfaces).
    await waitFor(() => expect(rows.map((r) => r.textContent)).toEqual(['DM-SHOP-UC01-FL01Add an item to the basket in the web appWeb app', 'DM-SHOP-UC01-FL02Add an item to the basket through the terminalTerminal · CLI']));
    expect(within(rows[1]).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', addressOf('DM-SHOP-UC01-FL02'));

    await openApp(`${addressOf('DM-SHOP-UC01-FL02')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket through the terminal' });
    const through = screen.getByText(/^Through/).closest('p')!;
    expect(through.textContent).toBe('Through DM-IF02Terminal CLI');
    expect(within(through).getByRole('link')).toHaveAttribute('href', addressOf('DM-IF02'));
  });

  it('LA-V51-R09-T01 An interface lists its flows by capability and the use cases with no flow through it', async () => {
    await openApp(`${addressOf('DM-IF02')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Terminal' });
    const flows = section(/^Flows through it/);
    expect(within(flows).getByRole('heading', { level: 3, name: /^Buying/ })).toBeInTheDocument();
    expect(within(flows).queryByRole('heading', { level: 3, name: /^Paying/ })).toBeNull();
    const rows = within(within(flows).getByRole('list', { name: 'Flows through DM-IF02: Buying' })).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['DM-SHOP-UC01-FL02Add an item to the basket through the terminalAdd an item to the basket']);
    const missing = section(/^Use cases with no flow through it/);
    const without = within(within(missing).getByRole('list', { name: 'Use cases with no flow through DM-IF02: Paying' })).getAllByRole('listitem');
    expect(without.map((r) => r.textContent)).toEqual(['DM-PAY-UC01Pay by card']);
    expect(within(missing).queryByRole('heading', { level: 3, name: /^Buying/ })).toBeNull();

    // Through the web app, every use case has its flow.
    await openApp(`${addressOf('DM-IF01')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Web app' });
    expect(within(section(/^Use cases with no flow through it/)).getByText('Every use case has a flow through this interface.')).toBeInTheDocument();
  });
});
