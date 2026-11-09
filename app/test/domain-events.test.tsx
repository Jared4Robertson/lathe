import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../src/views/address';
import { openApp, section } from './helpers';
import { modelWorkspace } from './fixtures/model';

// Domain events in the wiki: an aggregate's events are listed under their kind's plural label. What each row says
// (what raises it and how many policies hear it) is the Aggregate page's (aggregate-page.test.tsx).

const served = () => ({ data: modelWorkspace() });

describe('domain events in the wiki', () => {
  it("LA-V92-R09-T03 An aggregate's events are listed under their kind's plural label, Domain events", async () => {
    await openApp(`${addressOf('P-D-A3')}?stage=graph`, served());
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    expect(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' })).toBeInTheDocument();
  });
});
