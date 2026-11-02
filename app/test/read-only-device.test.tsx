import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';

// Another device on the network only reads (LA-PLT-UC23-R05): when the server marks its answers read-only, the
// Workbench says so in a note that stays, and no editor shows its actions (LA-V61-R55).

describe('LA-V61-R55-T01 a device the server marks read-only shows the note and no write actions', () => {
  it('shows "Read only on this device" and no Change toolbar, where this machine sees the toolbar and no note', async () => {
    await openApp('/DM', { readOnly: true });
    expect(await screen.findByText('Read only on this device')).toHaveAttribute('role', 'status');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('toolbar', { name: 'Change DM' })).toBeNull();

    await openApp('/DM');
    await screen.findByRole('toolbar', { name: 'Change DM' });
    await waitFor(() => expect(screen.queryByText('Read only on this device')).toBeNull());
  });
});
