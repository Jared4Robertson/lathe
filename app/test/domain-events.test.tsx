import './graph/setup';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { openApp, section } from './helpers';
import { modelWorkspace } from './fixtures/model';

// Domain events in the wiki: commands raise them, policies hear them (of their own domain, or another
// domain's published ones); the aggregate's "Domain events" list says what raises each and how many
// policies hear it.

const served = () => ({ data: modelWorkspace() });

describe('domain events in the wiki', () => {
  it("LA-V92-R09-T03 An aggregate's events are listed under their kind's plural label, Domain events", async () => {
    await openApp(`${addressOf('P-D-A3')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' })).toBeInTheDocument();
  });

  it('LA-V92-R60-T01 An aggregate\'s page lists its domain events titled "Domain events", each row a whole link saying what raises it, how many policies hear it and whether it is published', async () => {
    await openApp(`${addressOf('P-D-A3')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const list = within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'P-D-EV01Loan openedRaised by Open loanHeard by 1',
      'P-D-EV02Thing returnedRaised by Return thing',
    ]);
    // Each row is one link to its event (LA-PAT-APP-UX-R05).
    expect(within(rows[0]).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', addressOf('P-D-EV01'));

    await openApp(`${addressOf('P-D-A2')}?view=wiki`, served());
    await screen.findByRole('heading', { level: 1, name: 'Member' });
    const member = within(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A2' })).getAllByRole('listitem');
    expect(member.map((r) => r.textContent)).toEqual(['P-D-EV03Member joinedpublishedRaised by Register member']);
  });
});
