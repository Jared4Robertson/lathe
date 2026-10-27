import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { owedWorkspace } from './fixtures/owed-proof';
import { openApp, section } from './helpers';

// Proof still owed by planned tests beside the planned bar, and each domain's tests by state.

const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
const more = (element: HTMLElement, kind: string) => element.querySelector(`[data-kind="${kind}"] .bar.planned .bar-more`);
const testsLine = (element: HTMLElement) => within(element).getByLabelText('Tests by state').textContent;
const summary = (name: string) => within(section('Summary')).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

describe('owed proof and tests by state', () => {
  it('LA-TRC-T108 The planned bar says how many more obligations, already proved, still have a planned test', async () => {
    await openApp('/DM', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // DM-SHOP's domain rule: planned 0, planned_any 1.
    const rule = more(card('Shopping'), 'domain_rule') as HTMLElement;
    expect(rule.textContent).toBe('1 more planned');
    expect(rule.getAttribute('title')).toMatch(/Already proved.*proof still owed/);
    // Where planned_any equals planned (interaction requirements: 1 and 1), nothing more is shown.
    expect(more(card('Shopping'), 'interaction_requirement')).toBeNull();
    expect(more(card('Shopping'), 'requirement')).toBeNull();
    expect(card('Paying').querySelector('.bar-more')).toBeNull();

    // The domain page shows the same.
    await openApp('/DM-SHOP', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(more(section(/^Coverage/), 'domain_rule')?.textContent).toBe('1 more planned');
  });

  it("LA-TRC-T109 Each domain's coverage shows its tests by state, on the product and domain pages", async () => {
    await openApp('/DM', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(testsLine(card('Shopping'))).toBe('Tests 1 automated, 1 manual, 1 planned');
    expect(testsLine(card('Paying'))).toBe('Tests 2 automated, 0 manual, 0 planned');

    await openApp('/DM-SHOP', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const line = within(section(/^Coverage/)).getByLabelText('Tests by state');
    expect(line.textContent).toBe('Tests 1 automated, 1 manual, 1 planned');
    expect(line.querySelector('[data-state="planned"]')?.getAttribute('title')).toMatch(/does not count as proof/);
  });

  it("LA-TRC-T110 The summary counts the product's tests by state, and planned beside proof", async () => {
    await openApp('/DM', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(summary('Tests')).toBe('3 automated, 1 manual, 1 planned');
    expect(summary('Planned')).toBe('1 of 8 obligations, by tests not written yet; 1 more planned beside proof');
    // The proved count is unchanged: a planned test is never proof.
    expect(summary('Proved')).toBe('2 of 8 obligations');
  });
});
