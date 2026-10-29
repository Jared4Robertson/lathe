import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './graph/setup';
import { openApp } from './helpers';

// A stage or folder group is named by its own name.

describe('group names', () => {
  it('LA-V93-R25-T03 A stage or folder group page names the group by its own name, not by a kind ("Domain model", never "Domain models")', async () => {
    await openApp('/DM-SHOP/domain-model?stage=graph');
    await screen.findByRole('heading', { level: 1, name: /^Domain model/ });
    expect(document.querySelector('.group-intro')).toHaveTextContent(/^Domain model of DM-SHOP/);
    expect(document.body).not.toHaveTextContent('Domain models');
  });
});
