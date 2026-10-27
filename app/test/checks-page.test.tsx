import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp } from './helpers';

describe('checks page', () => {
  it("LA-CHK-T48 A space's Checks page lists its product's problems, errors first, grouped by check, each linking to its record, then the workspace's", async () => {
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    // Demo shop's one error and three warnings, and the workspace's one error; not Notebook's.
    expect(within(main()).getByText('2 errors · 3 warnings')).toBeInTheDocument();

    const groups = [...main().querySelectorAll('section')].map((s) => ({
      check: s.querySelector('h2, h3')?.firstChild?.textContent,
      severities: [...s.querySelectorAll('.severity')].map((e) => e.textContent),
      records: [...s.querySelectorAll('li')].map((li) => li.querySelector('a')?.getAttribute('href') ?? li.querySelector('code')?.textContent),
    }));
    expect(groups).toEqual([
      { check: 'test-file-missing', severities: ['error'], records: ['/DM-SHOP-T01'] },
      { check: 'unproved', severities: ['warning', 'warning'], records: ['/DM-SHOP-DR01', '/DM-SHOP-UC01-R02'] },
      { check: 'unsatisfied', severities: ['warning'], records: ['/DM-PAY-UC01-R01'] },
      { check: 'Workspace', severities: ['error'], records: ['workspace'] },
      { check: 'engine', severities: ['error'], records: ['workspace'] },
    ]);
    expect(main().textContent).not.toContain('NF-NOTE');
  });
});
