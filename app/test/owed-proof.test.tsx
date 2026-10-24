import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { obligationWorkspace } from './fixtures/obligations';
import { owedWorkspace } from './fixtures/owed-proof';
import { main, openApp, section } from './helpers';

// Proof still owed by planned tests beside the planned bar, and each domain's tests by state.

const card = (title: string) => within(section(/^Domains/)).getByText(title).closest('article') as HTMLElement;
const more = (element: HTMLElement, kind: string) => element.querySelector(`[data-kind="${kind}"] .bar.planned .bar-more`);
const testsLine = (element: HTMLElement) => within(element).getByLabelText('Tests by state').textContent;
const evidence = (name: string) => within(section('Evidence')).getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

describe('owed proof and tests by state', () => {
  it('LA-BRW-T180 The planned bar says how many more obligations, already proved, still have a planned test', async () => {
    await openApp('/specs/DM', { workspace: owedWorkspace() });
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
    await openApp('/specs/DM/DM-SHOP', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(more(section(/^Coverage/), 'domain_rule')?.textContent).toBe('1 more planned');
  });

  it('LA-BRW-T181 When the engine does not report planned_any, nothing more is claimed', async () => {
    await openApp('/specs/DM', { workspace: obligationWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(main().querySelector('.bar-more')).toBeNull();
    expect(evidence('Planned')).toBe('1 of 8 obligations, by tests not written yet');
  });

  it("LA-BRW-T182 Each domain's coverage shows its tests by state, on the product and domain pages", async () => {
    await openApp('/specs/DM', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(testsLine(card('Shopping'))).toBe('Tests 1 automated, 1 manual, 1 planned');
    expect(testsLine(card('Paying'))).toBe('Tests 2 automated, 0 manual, 0 planned');

    await openApp('/specs/DM/DM-SHOP', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const line = within(section(/^Coverage/)).getByLabelText('Tests by state');
    expect(line.textContent).toBe('Tests 1 automated, 1 manual, 1 planned');
    expect(line.querySelector('[data-state="planned"]')?.getAttribute('title')).toMatch(/does not count as proof/);
  });

  it('LA-BRW-T183 Tests the engine does not count show as not yet measured, never as zero', async () => {
    await openApp('/specs/DM', { workspace: owedWorkspace({ withoutTests: ['DM-PAY'] }) });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(testsLine(card('Paying'))).toBe('Tests not yet measured');
    expect(testsLine(card('Shopping'))).toBe('Tests 1 automated, 1 manual, 1 planned');
    // One domain unknown makes the product's total unknown.
    expect(evidence('Tests')).toBe('not yet measured');

    // A count left out on its own is unknown on its own.
    const ws = owedWorkspace();
    delete (ws.coverage.find((c) => c.domain === 'DM-PAY')!.tests as Partial<typeof ws.coverage[number]['tests']>).manual;
    await openApp('/specs/DM', { workspace: ws });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(testsLine(card('Paying'))).toBe('Tests 2 automated, manual not yet measured, 0 planned');
    expect(evidence('Tests')).toBe('3 automated, manual not yet measured, 1 planned');
  });

  it("LA-BRW-T184 The evidence counts the product's tests by state, and planned beside proof", async () => {
    await openApp('/specs/DM', { workspace: owedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(evidence('Tests')).toBe('3 automated, 1 manual, 1 planned');
    expect(evidence('Planned')).toBe('1 of 8 obligations, by tests not written yet; 1 more planned beside proof');
    // The proved count is unchanged: a planned test is never proof.
    expect(evidence('Proved')).toBe('2 of 8 obligations');
  });
});
