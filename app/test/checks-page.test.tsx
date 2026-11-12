import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addRows } from './fixtures/load';
import { gap, workspace } from './fixtures/workspace';
import { checksPanel, openApp } from './helpers';

// The Checks panel (LA-V41): a tool over the stage at `?panel=checks` (LA-PAT-APP-UX-R20).

const card = () => screen.getByRole('region', { name: 'Wiki card' });

describe('checks panel', () => {
  it("LA-V41-R01-T01 A space's Checks page lists its product's problems, errors first, grouped by check, each linking to its record, then the workspace's", async () => {
    const { requests } = await openApp('/DM?panel=checks');
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    // Demo shop's one error and three warnings, and the workspace's one error; not Notebook's: the Problems read's.
    expect(await within(checksPanel()).findByText('2 errors · 3 warnings')).toBeInTheDocument();
    expect(requests).toContain('GET /api/problems/list-problems?product_id=DM');

    // The Gaps and Not automated yet sections are the Dashboard's (LA-V157-R12): this test is about the problems.
    const groups = [...checksPanel().querySelectorAll('section:not(#gaps, #not-automated)')].map((s) => ({
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

  it("LA-V41-R01-T01 A strict product's Checks panel says warnings fail above its problems, with the warnings it accepts as a recorded deviation, and nothing of strictness otherwise", async () => {
    const strict = (accepted?: number) => addRows(workspace(), 'product_setting', { product_id: 'DM', max_children: 15, max_entities_per_aggregate: 7, technology_words: [], strict_check: true, ...(accepted ? { accepted_warnings: accepted } : {}) });
    const { requests, unmount } = await openApp('/DM?panel=checks', { data: strict() });
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    expect(await within(checksPanel()).findByText('Strict: warnings and gaps fail.')).toBeInTheDocument();
    expect(within(checksPanel()).getByText('2 errors · 3 warnings')).toBeInTheDocument();
    expect(requests).toContain('GET /api/product-setting/get-limits?product_id=DM');
    unmount();
    const { unmount: unmount2 } = await openApp('/DM?panel=checks', { data: strict(3) });
    expect(await within(checksPanel()).findByText('Strict: warnings and gaps fail, warnings beyond 3 accepted (a recorded deviation).')).toBeInTheDocument();
    unmount2();
    // Not strict: the counts say nothing of it.
    await openApp('/DM?panel=checks');
    expect(await within(checksPanel()).findByText('2 errors · 3 warnings')).toBeInTheDocument();
    expect(within(checksPanel()).queryByText(/^Strict/)).toBeNull();
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
  it('LA-V41-R01-T01 A record that misses the same thing in two places lists each gap once, under keys of their own', async () => {
    // The product served two routes no record has: two gaps on one record with one missing, told apart by their messages.
    const data = workspace();
    const own = data.coverage.find((c) => c.product === 'DM' && c.domain === null)!;
    own.gaps.push(
      { ...gap('DM', 'product', 'route-without-record'), message: 'The code serves /api/a, but no endpoint or view has that route.' },
      { ...gap('DM', 'product', 'route-without-record'), message: 'The code serves POST /api/a, but no endpoint has that route.' },
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await openApp('/DM?panel=checks', { data });
      await waitFor(() => expect(checksPanel()).toBeInTheDocument());
      const rows = await within(checksPanel()).findAllByText('route without record');
      expect(rows.map((r) => r.getAttribute('title'))).toEqual([
        'The code serves /api/a, but no endpoint or view has that route.',
        'The code serves POST /api/a, but no endpoint has that route.',
      ]);
      expect(logged.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
    } finally { logged.mockRestore(); }
  });
});
