import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp } from './helpers';

describe('checks page', () => {
  it('LA-BRW-T14 The checks page lists every problem, errors first, grouped by check, each linking to its record', async () => {
    await openApp('/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(within(main()).getByText('3 errors · 3 warnings')).toBeInTheDocument();

    const groups = [...main().querySelectorAll('section')].map((s) => ({
      check: s.querySelector('h2')?.firstChild?.textContent,
      severities: [...s.querySelectorAll('.severity')].map((e) => e.textContent),
      records: [...s.querySelectorAll('li')].map((li) => li.querySelector('a')?.getAttribute('href') ?? li.querySelector('code')?.textContent),
    }));
    expect(groups).toEqual([
      { check: 'dangling-link', severities: ['error'], records: ['/NF-NOTE'] },
      { check: 'meta-model', severities: ['error'], records: ['workspace'] },
      { check: 'test-file-missing', severities: ['error'], records: ['/DM-SHOP-T01'] },
      { check: 'unproved', severities: ['warning', 'warning'], records: ['/DM-SHOP-DR01', '/DM-SHOP-UC01-R02'] },
      { check: 'unsatisfied', severities: ['warning'], records: ['/DM-PAY-UC01-R01'] },
    ]);
  });
});
