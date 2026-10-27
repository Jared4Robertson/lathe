import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { KindDescription } from '../../lathe/src/store/schema';
import { branchOf, domainFolders, folderPath, productFolders } from '../src/specs/folders';
import { workspace } from './fixtures/workspace';
import { patternWorkspace } from './fixtures/patterns';
import { main, openApp } from './helpers';
import { addRows, indexOf } from './fixtures/load';

// The side nav and the domain page read in the five stages: what sits at product level in the
// product's own stages, and in each domain its Domain model, Use cases, Interaction design, Technical
// specification and Test plan, one folder per kind, then open questions. Names and order come from
// the schema's stages and kinds.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
/** A nav list that may appear a moment after the page, once the nav opens the current page's branch. */
const findList = (name: string) => within(panel()).findByRole('list', { name });
/** The folder rows (buttons) directly in a nav list, as "Label count". */
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;

/** A product's own kind under the domain. */
const ownKind = (name: string, label: string, stage: 'domain-model' | null): KindDescription => ({
  name, label, stage, obligation: false, idPattern: null, idExample: null, idScope: null, productId: 'DM', position: null, description: `A ${name}.`,
  parents: [{ kind: 'domain', column: 'domain_id' }], supertypes: [],
});

describe('folders by stage', () => {
  it('LA-EXP-T84 Under the space, one level shows: domains are folded rows, and a domain unfolds into its stages and open questions with counts', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    // One level: the domains, each folded.
    expect(within(panel()).getByRole('button', { name: 'Unfold Shopping' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByRole('list', { name: 'Folders of Shopping' })).toBeNull();

    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    const folders = list('Folders of Shopping');
    expect(rows(folders)).toEqual(['Domain model4', 'Use cases1', 'Interaction design2', 'Technical specification2', 'Test plan2', 'Open questions1']);
    // Each stage folds on its own and opens one level: its folders, one per kind, still folded.
    await user.click(head(folders, /^Domain model/));
    expect(rows(list('Domain model of Shopping'))).toEqual(['Aggregates1', 'Specifications1', 'Read models1', 'Terms1']);
    expect(within(panel()).queryByRole('list', { name: 'Aggregates of Shopping' })).toBeNull();
    await user.click(head(folders, /^Interaction design/));
    expect(rows(list('Interaction design of Shopping'))).toEqual(['Flows1', 'Endpoints1']);
    await user.click(head(list('Interaction design of Shopping'), /^Endpoints/));
    expect(within(list('Endpoints of Shopping')).getAllByRole('link').map((a) => a.textContent)).toEqual(['Add to basket']);
    await user.click(head(folders, /^Open questions/));
    expect(within(list('Open questions of Shopping')).getByRole('link', { name: 'What happens to a basket overnight?' })).toHaveAttribute('href', '/DM-SHOP-Q01');

    // Folding a stage hides its folders.
    await user.click(head(folders, /^Interaction design/));
    expect(within(panel()).queryByRole('list', { name: 'Interaction design of Shopping' })).toBeNull();
  });

  it('LA-EXP-T85 A stage or folder with no records is left out of the nav', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Paying' }));
    // Paying has an aggregate and a use case and nothing designed yet: no Interaction design, no tests.
    expect(rows(list('Folders of Paying'))).toEqual(['Domain model1', 'Use cases1']);
    await user.click(head(list('Folders of Paying'), /^Use cases/));
    expect(rows(list('Use cases of Paying'))).toEqual(['Capabilities1']);
  });

  it("LA-EXP-T86 The current page's branch opens itself: a record's domain, stage and folder, or a group's folder", async () => {
    // A UC requirement is not listed; the capability it sits under is, so that capability's branch opens.
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(within(await findList('Capabilities of Shopping')).getByRole('link', { name: 'Buying' })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    expect(within(panel()).queryByRole('list', { name: 'Interaction design of Shopping' })).toBeNull();

    await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    expect(within(await findList('Command handlers of Shopping')).getByRole('link', { name: 'Basket service' })).toHaveAttribute('aria-current', 'page');

    // A group page opens the folder of its kind, and names it as the nav does.
    await openApp('/DM-SHOP/interaction-design/endpoint');
    await screen.findByRole('heading', { level: 1, name: /^Endpoints/ });
    expect(within(await findList('Endpoints of Shopping')).getByRole('link', { name: 'Add to basket' })).toBeInTheDocument();
    expect(main().querySelector('.group-folder')).toHaveTextContent('Interaction design');

    // The domain page opens its domain.
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(await within(panel()).findByRole('button', { name: 'Fold Paying' })).toHaveAttribute('aria-expanded', 'true');
    expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('domain:DM-PAY');
  });

  it('LA-EXP-T87 Stage names and order come from the schema, in the nav and on the domain page alike', async () => {
    const w = workspace();
    w.schema.stages = w.schema.stages.map((s) => (s.name === 'test-plan' ? { ...s, label: 'Tests and checks', position: 0 } : s));
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(rows(await findList('Folders of Shopping'))).toEqual(['Tests and checks2', 'Domain model4', 'Use cases1', 'Interaction design2', 'Technical specification2', 'Open questions1']);
    expect([...main().querySelectorAll('h2.stage-title')].map((h) => h.childNodes[1]?.textContent)).toEqual(['Tests and checks', 'Domain model', 'Use cases', 'Interaction design', 'Technical specification']);
  });

  it('LA-EXP-T88 The product shows its own stages only when it has records at product level, before its domains', async () => {
    await openApp('/DM', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // One Product level folder before the domains holds the product's own stages, as the graph's tree has it.
    expect(rows(list('Product level of Demo shop'))).toEqual(['Product level4']);
    const user = userEvent.setup();
    await user.click(head(list('Product level of Demo shop'), /^Product level/));
    const own = list('Stages of Demo shop');
    // A pattern rule test sits under its rule, at product level too.
    expect(rows(own)).toEqual(['Domain model1', 'Use cases1', 'Interaction design1', 'Test plan1']);
    await user.click(head(own, /^Use cases/));
    await user.click(head(list('Use cases of Demo shop'), /^Patterns/));
    expect(within(list('Patterns of Demo shop')).getByRole('link', { name: 'Audited action' })).toHaveAttribute('href', '/DM-PAT-AUDIT');
    // The product's open questions are a group of their own.
    expect(within(list('Groups of Demo shop')).getByRole('link', { name: /Open questions/ })).toHaveAttribute('href', '/DM/question');

    // A pattern rule's page opens the product's Use cases.
    await openApp('/DM-PAT-AUDIT-R01', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Each change is recorded' });
    expect(within(await findList('Patterns of Demo shop')).getByRole('link', { name: 'Audited action' })).toBeInTheDocument();

    // Notebook has nothing at product level.
    await openApp('/NF');
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    expect(within(panel()).queryByRole('list', { name: 'Product level of Notebook' })).toBeNull();
  });

  it("LA-EXP-T89 A record is listed in its stage's folder when its parent is of another stage, and folds under its parent in the same stage", async () => {
    const w = workspace();
    addRows(w, 'use_case', { id: 'DM-SHOP-UC02', title: 'Empty the basket', capability_id: 'DM-SHOP-CAP01' });
    addRows(w, 'flow', { id: 'DM-SHOP-UC02-FL', title: 'Empty a basket', use_case_id: 'DM-SHOP-UC02' });
    const index = indexOf(w);
    const { stages, loose } = domainFolders(index, 'DM-SHOP');
    const ids = Object.fromEntries(stages.flatMap((s) => s.folders).filter((f) => f.count > 0).map((f) => [f.kind, f.records.map((r) => r.id)]));
    expect(ids).toEqual({
      aggregate: ['DM-SHOP-A1'],
      specification: ['DM-SHOP-SP01'],
      read_model: ['DM-SHOP-RM01'],
      term: ['DM-SHOP-TM01'],
      capability: ['DM-SHOP-CAP01'],
      flow: ['DM-SHOP-UC01-FL', 'DM-SHOP-UC02-FL'],
      endpoint: ['DM-SHOP-EP01'],
      table: ['DM-SHOP-EN01-TB'],
      command_handler: ['DM-SHOP-CMD01-H'],
      invariant_test: ['DM-SHOP-INV01-T'],
      use_case_test: ['DM-SHOP-UC01-R01-T01'],
    });
    expect(loose.map((f) => [f.label, f.records.map((r) => r.id)])).toEqual([['Open questions', ['DM-SHOP-Q01']]]);
    // A use case folds under its capability, in Use cases; a command under its aggregate, in Domain model.
    expect(branchOf(index, 'DM-SHOP-UC02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/use-cases', 'DM-SHOP/use-cases/capability']);
    expect(branchOf(index, 'DM-SHOP-CMD01')).toEqual(['domain:DM-SHOP', 'DM-SHOP/domain-model', 'DM-SHOP/domain-model/aggregate']);
    // A flow step folds under its flow, in Interaction design.
    expect(branchOf(index, 'DM-SHOP-UC01-FL-S02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/interaction-design', 'DM-SHOP/interaction-design/flow']);
    // At product level: a constraint folds under its value object; a view at product level.
    expect(branchOf(index, 'DM-VO01-C01')).toEqual(['DM/product-level', 'DM/domain-model', 'DM/domain-model/value_object']);
    expect(productFolders(index, 'DM').stages.filter((s) => s.count > 0).map((s) => [s.label, s.folders.filter((f) => f.count > 0).map((f) => f.label)])).toEqual([
      ['Domain model', ['Value objects']],
      ['Interaction design', ['Views']],
    ]);

    // The domain page: the capability's use cases fold under it.
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const capabilities = within(main()).getByRole('heading', { level: 3, name: /^Capabilities/ }).closest('section') as HTMLElement;
    expect(within(capabilities).queryByRole('link', { name: /DM-SHOP-UC02/ })).toBeNull();
    // In the nav, a capability's use case opens the branch of its capability, in Use cases.
    await openApp('/DM-SHOP-UC02', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Empty the basket' });
    await waitFor(() => expect(list('Capabilities of Shopping').textContent).toBe('Buying'));
  });

  it("LA-EXP-T90 A product's own kind gets its folder in its stage, or after the stages when it has no stage; the path names its stage", () => {
    const w = workspace();
    w.schema.kinds.risk = ownKind('risk', 'Risk', 'domain-model');
    w.schema.kinds.memo = ownKind('memo', 'Memo', null);
    addRows(w, 'risk', { id: 'DM-SHOP-RK01', title: 'Baskets get lost', domain_id: 'DM-SHOP' });
    addRows(w, 'memo', { id: 'DM-SHOP-M01', title: 'A note', domain_id: 'DM-SHOP' });
    const index = indexOf(w);
    const { stages, loose } = domainFolders(index, 'DM-SHOP');
    expect(stages[0].folders.filter((f) => f.count > 0).map((f) => f.label)).toEqual(['Aggregates', 'Specifications', 'Read models', 'Terms', 'Risks']);
    expect(loose.map((f) => f.label)).toEqual(['Open questions', 'Memos']);
    expect(folderPath(index, 'use_case')).toEqual(['Use cases']);
    expect(folderPath(index, 'risk')).toEqual(['Domain model']);
    expect(folderPath(index, 'question')).toEqual([]);
  });

  it('LA-EXP-T91 What is folded is remembered for the session', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    await user.click(head(list('Folders of Shopping'), /^Test plan/));
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(rows(list('Test plan of Shopping'))).toEqual(['Invariant tests1', 'Use case tests1']);
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();
  });
});
