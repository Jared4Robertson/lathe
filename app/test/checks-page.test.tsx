import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp } from './helpers';
import { modelWorkspace } from './fixtures/model';

describe('checks page', () => {
  it("LA-V41-R01-T01 A space's Checks page lists its product's problems, errors first, grouped by check, each linking to its record, then the workspace's", async () => {
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
      { check: 'test-file-missing', severities: ['error'], records: ['/DM-SHOP-UC01-R01-T01'] },
      { check: 'not-designed', severities: ['warning'], records: ['/DM-PAY-UC01-R01'] },
      { check: 'not-proved', severities: ['warning', 'warning'], records: ['/DM-SHOP-INV01', '/DM-SHOP-UC01-R02'] },
      { check: 'Workspace', severities: ['error'], records: ['workspace'] },
      { check: 'engine', severities: ['error'], records: ['workspace'] },
    ]);
    expect(main().textContent).not.toContain('NF-NOTE');
    // Demo shop records no exception, so it has no such section.
    expect(within(main()).queryByRole('heading', { name: /^Recorded exceptions/ })).toBeNull();
  });

  it("LA-V41-R04-T01 A space's Checks page lists its recorded exceptions in their own section, never as problems", async () => {
    await openApp('/P/checks', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    // The model's one error and one warning; Return thing's recorded exception is not counted.
    expect(within(main()).getByText('1 error · 1 warning')).toBeInTheDocument();
    const section = within(main()).getByRole('heading', { level: 2, name: /^Recorded exceptions/ }).closest('section')!;
    const rows = within(within(section).getByRole('list', { name: 'Recorded exceptions' })).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByRole('link', { name: /P-D-CMD02/ })).toHaveAttribute('href', '/P-D-CMD02');
    expect(within(rows[0]).getByRole('link', { name: /P-D-A1/ })).toHaveAttribute('href', '/P-D-A1');
    expect(rows[0]).toHaveTextContent('also changes P-D-A1 in the same transaction: The thing must be lendable again in the same transaction as its return.');
    expect(section.querySelector('.severity, .problem')).toBeNull();
  });
});
