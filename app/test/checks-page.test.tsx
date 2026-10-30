import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { checksPanel, openApp } from './helpers';
import { modelWorkspace } from './fixtures/model';

// The Checks panel (LA-V41): a tool over the stage at `?panel=checks` (LA-PAT-APP-UX-R20).

const card = () => screen.getByRole('region', { name: 'Wiki card' });

describe('checks panel', () => {
  it("LA-V41-R01-T01 A space's Checks page lists its product's problems, errors first, grouped by check, each linking to its record, then the workspace's", async () => {
    const { requests } = await openApp('/DM?panel=checks');
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    // Demo shop's one error and three warnings, and the workspace's one error; not Notebook's: the Problems read's.
    expect(await within(checksPanel()).findByText('2 errors · 3 warnings')).toBeInTheDocument();
    expect(requests).toContain('GET /api/problems/list-problems?product_id=DM');

    const groups = [...checksPanel().querySelectorAll('section')].map((s) => ({
      check: s.querySelector('h3, h4')?.firstChild?.textContent,
      severities: [...s.querySelectorAll('.severity')].map((e) => e.textContent),
      records: [...s.querySelectorAll('li')].map((li) => li.querySelector('a')?.getAttribute('href') ?? li.querySelector('code')?.textContent) }));
    expect(groups).toEqual([
      { check: 'test-file-missing', severities: ['error'], records: ['/DM-SHOP-UC01-R01-T01'] },
      { check: 'not-designed', severities: ['warning'], records: ['/DM-PAY-UC01-R01'] },
      { check: 'not-proved', severities: ['warning', 'warning'], records: ['/DM-SHOP-INV01', '/DM-SHOP-UC01-R02'] },
      { check: 'Workspace', severities: ['error'], records: ['/DM?panel=checks&page=format/checks/engine'] },
      // A workspace problem names no record, so its row opens its check in the wiki card (LA-PAT-APP-UX-R14).
      { check: 'engine', severities: ['error'], records: ['/DM?panel=checks&page=format/checks/engine'] },
    ]);
    expect(checksPanel().textContent).not.toContain('NF-NOTE');
    // Demo shop records no exception, so it has no such section.
    expect(within(checksPanel()).queryByRole('heading', { name: /^Recorded exceptions/ })).toBeNull();
  });

  it('LA-V41-R01-T03 Selecting a problem focuses its record on the stage and in the wiki card, and the panel stays open with its row marked', async () => {
    await openApp('/DM?panel=checks');
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(await within(checksPanel()).findByRole('link', { name: 'DM-SHOP-INV01' }));
    expect(window.location.pathname + window.location.search).toBe('/DM-SHOP-INV01?panel=checks');
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'DM-SHOP-INV01'));
    expect(checksPanel().querySelector('li.problem.is-current')).toHaveTextContent('DM-SHOP-INV01');
    // A workspace problem opens its check's page in the card, the stage keeping its focus.
    await user.click(within(checksPanel()).getAllByRole('link', { name: 'engine' })[0]);
    expect(window.location.pathname + window.location.search).toBe('/DM-SHOP-INV01?panel=checks&page=format/checks/engine');
    await waitFor(() => expect(within(card()).getByRole('heading', { level: 2, name: 'engine' })).toBeInTheDocument());
    // Escape closes the topmost overlay first (the card's page), then the panel, and focus comes back.
    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('?panel=checks');
    await user.keyboard('{Escape}');
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('region', { name: 'Checks' })).toBeNull();
  });

  it("LA-V41-R04-T01 A space's Checks page lists its recorded exceptions in their own section, never as problems", async () => {
    await openApp('/P?panel=checks', { data: modelWorkspace() });
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    // The model's one error and one warning; Return thing's and LoanRepository's recorded exceptions are not counted.
    expect(await within(checksPanel()).findByText('1 error · 1 warning')).toBeInTheDocument();
    const section = within(checksPanel()).getByRole('heading', { level: 3, name: /^Recorded exceptions/ }).closest('section')!;
    const rows = within(within(section).getByRole('list', { name: 'Recorded exceptions' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('link', { name: /P-D-CMD02/ })).toHaveAttribute('href', '/P-D-CMD02');
    expect(within(rows[0]).getByRole('link', { name: /P-D-A1/ })).toHaveAttribute('href', '/P-D-A1');
    expect(rows[0]).toHaveTextContent('also changes P-D-A1 in the same transaction: The thing must be lendable again in the same transaction as its return.');
    // A repository that also persists another aggregate, which has no repository of its own.
    expect(within(rows[1]).getByRole('link', { name: /P-D-REPO01/ })).toHaveAttribute('href', '/P-D-REPO01');
    expect(within(rows[1]).getByRole('link', { name: /P-D-A4/ })).toHaveAttribute('href', '/P-D-A4');
    expect(rows[1]).toHaveTextContent('also persists P-D-A4: Shelves are stored with the loans that take things off them.');
    expect(section.querySelector('.severity, .problem')).toBeNull();
  });
});
