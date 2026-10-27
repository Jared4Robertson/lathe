import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { KindDescription } from '../../lathe/src/store/schema';
import { branchOf, domainFolders, folderPath } from '../src/specs/folders';
import { workspace } from './fixtures/workspace';
import { patternWorkspace } from './fixtures/patterns';
import { main, openApp } from './helpers';
import { addRows, indexOf } from './fixtures/load';

// The side nav and the domain page read like S2's spec folders: Shared at product level, and in
// each domain Define (Domain model, Use cases) and Design (Interaction design, Technical
// specification, Test plan), then open questions. Names and order come from the schema's sections.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
/** A nav list that may appear a moment after the page, once the nav opens the current page's branch. */
const findList = (name: string) => within(panel()).findByRole('list', { name });
/** The folder rows (buttons) directly in a nav list, as "Label count". */
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;

/** A product's own kind under the domain, with no folder. */
const ownKind = (name: string, label: string, stage: 'define' | null): KindDescription => ({
  name, label, stage, section: null, obligation: 'none', idPattern: null, idExample: null, productId: 'DM', description: `A ${name}.`,
  parents: [{ kind: 'domain', column: 'domain_id' }], supertypes: [],
});

describe('folders like S2', () => {
  it('LA-EXP-T84 Under the space, one level shows: domains are folded rows, and a domain unfolds into Define, Design and Open questions with counts', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    // One level: the domains, each folded.
    expect(within(panel()).getByRole('button', { name: 'Unfold Shopping' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByRole('list', { name: 'Folders of Shopping' })).toBeNull();

    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    const folders = list('Folders of Shopping');
    expect(rows(folders)).toEqual(['Define2', 'Design5', 'Open questions1']);
    // Each stage folds on its own and opens one level: its folders, still folded.
    await user.click(head(folders, /^Define/));
    expect(rows(list('Define of Shopping'))).toEqual(['Domain model1', 'Capabilities1']);
    expect(within(panel()).queryByRole('list', { name: 'Domain model of Shopping' })).toBeNull();
    await user.click(head(folders, /^Design/));
    expect(rows(list('Design of Shopping'))).toEqual(['Interaction design3', 'Technical specification1', 'Test plan1']);
    await user.click(head(list('Design of Shopping'), /^Interaction design/));
    expect(within(list('Interaction design of Shopping')).getAllByRole('link').map((a) => a.textContent)).toEqual(['Fill a basket', 'Basket page', 'Add to basket']);
    await user.click(head(folders, /^Open questions/));
    expect(within(list('Open questions of Shopping')).getByRole('link', { name: 'What happens to a basket overnight?' })).toHaveAttribute('href', '/DM-SHOP-Q01');

    // Folding a stage hides its folders.
    await user.click(head(folders, /^Design/));
    expect(within(panel()).queryByRole('list', { name: 'Design of Shopping' })).toBeNull();
  });

  it('LA-EXP-T85 A stage or folder with no records is left out of the nav', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Paying' }));
    // Paying has one use case and nothing designed yet: Define with only Use cases, no Design.
    expect(rows(list('Folders of Paying'))).toEqual(['Define1']);
    await user.click(head(list('Folders of Paying'), /^Define/));
    expect(rows(list('Define of Paying'))).toEqual(['Capabilities1']);
  });

  it("LA-EXP-T86 The current page's branch opens itself: a record's domain, stage and folder, or a group's folder", async () => {
    // A requirement is not listed; the use case it sits under is, so that use case's branch opens.
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(within(await findList('Capabilities of Shopping')).getByRole('link', { name: 'Add an item to the basket' })).toHaveAttribute('href', '/DM-SHOP-UC01');
    expect(within(panel()).queryByRole('list', { name: 'Design of Shopping' })).toBeNull();

    await openApp('/DM-SHOP-C01');
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    expect(within(await findList('Technical specification of Shopping')).getByRole('link', { name: 'Basket service' })).toHaveAttribute('aria-current', 'page');

    // A group page opens the folder of its kind, and names it as the nav does.
    await openApp('/DM-SHOP/design/interaction-design/view');
    await screen.findByRole('heading', { level: 1, name: /^Views/ });
    expect(within(await findList('Interaction design of Shopping')).getByRole('link', { name: 'Basket page' })).toBeInTheDocument();
    expect(main().querySelector('.group-folder')).toHaveTextContent('Design › Interaction design');

    // The domain page opens its domain.
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(await within(panel()).findByRole('button', { name: 'Fold Paying' })).toHaveAttribute('aria-expanded', 'true');
    expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('domain:DM-PAY');
  });

  it('LA-EXP-T87 Folder names and order come from the schema sections, in the nav and on the domain page alike', async () => {
    const w = workspace();
    w.schema.sections = w.schema.sections.map((s) => (s.name === 'test-plan' ? { ...s, label: 'Tests and checks', position: 0 } : s));
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const user = userEvent.setup();
    await user.click(head(list('Folders of Shopping'), /^Design/));
    expect(rows(list('Design of Shopping'))).toEqual(['Tests and checks1', 'Interaction design3', 'Technical specification1']);
    const design = within(main()).getByRole('heading', { level: 2, name: 'Design' }).parentElement as HTMLElement;
    expect([...design.querySelectorAll('h3')].map((h) => h.firstChild?.textContent)).toEqual(['Tests and checks', 'Interaction design', 'Technical specification']);
  });

  it('LA-EXP-T88 The product shows a Shared folder only when it has patterns, and patterns leave its groups', async () => {
    await openApp('/DM', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const shared = list('Shared by Demo shop');
    expect(rows(shared)).toEqual(['Shared1']);
    await userEvent.setup().click(head(shared, /^Shared/));
    expect(within(list('Shared of Demo shop')).getByRole('link', { name: 'Checkout step' })).toHaveAttribute('href', '/DM-PAT-CHECKOUT');
    expect(within(list('Groups of Demo shop')).queryByRole('link', { name: /Patterns/ })).toBeNull();

    // A pattern rule's page opens Shared.
    await openApp('/DM-PAT-CHECKOUT-R01', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'The step shows what it saved' });
    expect(within(list('Shared of Demo shop')).getByRole('link', { name: 'Checkout step' })).toBeInTheDocument();

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(panel()).queryByRole('list', { name: 'Shared by Demo shop' })).toBeNull();
  });

  it("LA-EXP-T89 A capability's flows and tests sit in Interaction design and Test plan, its use cases under it; Use cases lists capabilities, then use cases outside any", async () => {
    const w = workspace();
    addRows(w, 'capability', { id: 'DM-SHOP-CAP01', title: 'Filling the basket', domain_id: 'DM-SHOP', position: 1 });
    addRows(w, 'use_case', { id: 'DM-SHOP-UC02', title: 'Empty the basket', domain_id: 'DM-SHOP', capability_id: 'DM-SHOP-CAP01' });
    addRows(w, 'flow', { id: 'DM-SHOP-F02', title: 'Empty a basket', domain_id: 'DM-SHOP', capability_id: 'DM-SHOP-CAP01' });
    addRows(w, 'test', { id: 'DM-SHOP-T02', title: 'Emptying clears it', domain_id: 'DM-SHOP', capability_id: 'DM-SHOP-CAP01', test_type: 'acceptance', state: 'planned' });
    const index = indexOf(w);
    const { stages, loose } = domainFolders(index, 'DM-SHOP');
    const ids = Object.fromEntries(stages.flatMap((s) => s.folders).map((f) => [f.section, f.records.map((r) => r.id)]));
    expect(ids).toEqual({
      'domain-model': ['DM-SHOP-A1'],
      'use-cases': ['DM-SHOP-CAP01', 'DM-SHOP-UC01'],
      'interaction-design': ['DM-SHOP-F01', 'DM-SHOP-F02', 'DM-SHOP-V01', 'DM-SHOP-E01'],
      'technical-specification': ['DM-SHOP-C01'],
      'test-plan': ['DM-SHOP-T01', 'DM-SHOP-T02'],
    });
    expect(loose.map((f) => [f.label, f.records.map((r) => r.id)])).toEqual([['Open questions', ['DM-SHOP-Q01']]]);
    expect(branchOf(index, 'DM-SHOP-UC02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/define', 'DM-SHOP/define/use-cases']);
    // A capability's test is an acceptance test, in its capability, which opens with it.
    expect(branchOf(index, 'DM-SHOP-T02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', 'DM-SHOP/design/test-plan', 'DM-SHOP/design/test-plan/acceptance/DM-SHOP-CAP01']);

    // The domain page: Use cases holds the capabilities and then the use cases outside any capability.
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const useCases = within(main()).getByRole('heading', { level: 3, name: /^Capabilities/ }).closest('section') as HTMLElement;
    expect([...useCases.querySelectorAll('h4')].map((h) => h.firstChild?.textContent)).toEqual(['Capabilities', 'Use cases outside any capability']);
    // In the nav, the same: a capability's use case opens the branch of its capability, in Use cases.
    await openApp('/DM-SHOP-UC02', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Empty the basket' });
    await waitFor(() => expect(list('Capabilities of Shopping').textContent).toBe('Filling the basketAdd an item to the basket'));
  });

  it('LA-EXP-T90 A kind in no known folder gets its own folder at the end of its stage, or after the stages when it has no stage; the path names its folder', () => {
    const w = workspace();
    w.schema.kinds.risk = ownKind('risk', 'Risk', 'define');
    w.schema.kinds.memo = ownKind('memo', 'Memo', null);
    addRows(w, 'risk', { id: 'DM-SHOP-RK01', title: 'Baskets get lost', domain_id: 'DM-SHOP' });
    addRows(w, 'memo', { id: 'DM-SHOP-M01', title: 'A note', domain_id: 'DM-SHOP' });
    const index = indexOf(w);
    const { stages, loose } = domainFolders(index, 'DM-SHOP');
    expect(stages[0].folders.map((f) => f.label)).toEqual(['Domain model', 'Capabilities', 'Risks']);
    expect(loose.map((f) => f.label)).toEqual(['Open questions', 'Memos']);
    expect(folderPath(index, 'use_case')).toEqual(['Define', 'Capabilities']);
    expect(folderPath(index, 'risk')).toEqual(['Define']);
    expect(folderPath(index, 'question')).toEqual([]);
  });

  it('LA-EXP-T91 What is folded is remembered for the session, and every record is listed without sections', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    await user.click(head(list('Folders of Shopping'), /^Design/));
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(rows(list('Design of Shopping'))).toEqual(['Interaction design3', 'Technical specification1', 'Test plan1']);
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();

    // Without sections, each kind is a folder of its own under its stage.
    const w = workspace();
    w.schema.sections = [];
    const index = indexOf(w);
    const { stages } = domainFolders(index, 'DM-SHOP');
    expect(stages.map((s) => [s.label, s.folders.map((f) => f.label)])).toEqual([
      ['Define', ['Aggregates', 'Use cases']],
      ['Design', ['Flows', 'Views', 'Endpoints', 'Components', 'Tests']],
    ]);
  });
});
