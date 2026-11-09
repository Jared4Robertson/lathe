import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ownerFolders } from '../src/exploring/folder-tree/folders';
import { treeChildren, treeParent } from '../src/graph/tree';
import { modelIndex, modelWorkspace } from './fixtures/model';
import { main, openApp, section, stageOf } from './helpers';

// How the nav, the domain, product and group pages and the record page read a domain by stage and
// kind (LA-V90, LA-V91, LA-V92): a group that is a record links and one the app computes only
// folds, the technical and test kinds in the plan's order, and the records with no owner. A command's endpoints are on
// its own page (command-page.test.tsx), an endpoint's and an integration's on theirs (endpoint-page.test.tsx and
// integration-page.test.tsx).

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
const findList = (name: string) => within(panel()).findByRole('list', { name });
/** The folder rows (buttons) directly in a nav list, as "Label count". */
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;
/** The domain page's sections of a stage, as their h3 headings' text. */
const kindHeadings = (stage: string) => {
  const title = [...main().querySelectorAll('h2.stage-title')].find((h) => h.childNodes[1]?.textContent === stage)!;
  return [...title.closest('.stage')!.querySelectorAll(':scope > section.folder')].map((s) => s.querySelector('h3, h4, h5')!.textContent);
};

/** Shopping unfolded in the nav, on the space's page. */
async function shoppingUnfolded() {
  await openApp('/DM');
  await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
  const user = userEvent.setup();
  await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
  return { user, folders: list('Folders of Shopping') };
}

describe('groups by stage and kind', () => {
  it('LA-V90-R02-T01 In the nav, a capability is a link heading its use cases, and a stage or kind folder only folds', async () => {
    const { user, folders } = await shoppingUnfolded();
    // A stage and a kind folder are buttons that fold, with no link.
    const stage = head(folders, /^Use cases/);
    expect(stage.tagName).toBe('BUTTON');
    expect(stage).toHaveAttribute('aria-expanded', 'false');
    expect(stage.closest('li')!.querySelector(':scope > a')).toBeNull();
    await user.click(stage);
    // The capability, a record, links to its own page; Use cases holds only capabilities, so lists them itself.
    expect(within(list('Use cases of Shopping')).getByRole('link', { name: 'Buying' })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    await user.click(head(folders, /^Interface design/));
    const kind = head(list('Interface design of Shopping'), /^Views/);
    expect(kind.tagName).toBe('BUTTON');
    expect(kind.closest('li')!.querySelector(':scope > a')).toBeNull();
  });

  it('LA-V90-R02-T02 On the domain page, a capability heading its use cases links to its page, and the stage and kind headings are not links', async () => {
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    for (const h of main().querySelectorAll('h2.stage-title, h3')) expect(h.querySelector('a'), h.textContent!).toBeNull();
    const capabilities = stageOf('use-cases');
    expect(within(capabilities).getByRole('link', { name: /DM-SHOP-CAP01/ })).toHaveAttribute('href', '/DM-SHOP-CAP01');
  });

  it('LA-V90-R20-T01 In the nav, Technical specification and Test plan fold into kind folders with counts, one level at a time, folded for the session', async () => {
    const { user, folders } = await shoppingUnfolded();
    expect(rows(folders)).toEqual(expect.arrayContaining(['Technical specification2', 'Test plan2']));
    await user.click(head(folders, /^Technical specification/));
    // One level: the kind folders, still folded.
    expect(rows(list('Technical specification of Shopping'))).toEqual(['Tables1', 'Command handlers1']);
    expect(within(panel()).queryByRole('list', { name: 'Command handlers of Shopping' })).toBeNull();
    await user.click(head(folders, /^Test plan/));
    expect(rows(list('Test plan of Shopping'))).toEqual(['Invariant tests1', 'Use case tests1']);
    // A kind folder's row only folds.
    const kind = head(list('Test plan of Shopping'), /^Use case tests/);
    expect(kind.tagName).toBe('BUTTON');
    await user.click(kind);
    expect(within(list('Use case tests of Shopping')).getByRole('link', { name: 'Adding an item shows it' })).toHaveAttribute('href', '/DM-SHOP-UC01-R01-T01');
    // What is folded lasts for the session, and no longer.
    expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('DM-SHOP/test-plan');
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();
  });

  it("LA-V90-R20-T02 A test's or a technical record's page opens its branch through its stage and kind folder", async () => {
    await openApp('/DM-SHOP-INV01-T');
    await screen.findByRole('heading', { level: 1, name: 'A 51st line is refused' });
    expect(within(await findList('Invariant tests of Shopping')).getByRole('link', { name: 'A 51st line is refused' })).toHaveAttribute('aria-current', 'page');
    await openApp('/DM-SHOP-EN01-TB');
    await screen.findByRole('heading', { level: 1, name: 'baskets' });
    expect(within(await findList('Tables of Shopping')).getByRole('link', { name: 'baskets' })).toHaveAttribute('aria-current', 'page');
  });

  it('LA-V90-R21-T01 Records with no owner sit in the one domain that uses them, or else in Shared by stage, and a specification in its domain\'s Domain model', async () => {
    // Both domains use the value object, so the product shares it, in the nav and on the product page.
    await openApp('/P', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Product' });
    const user = userEvent.setup();
    expect(rows(list('Shared in Product'))).toEqual(['Shared4']);
    await user.click(head(list('Shared in Product'), /^Shared/));
    expect(rows(list('Stages of Product'))).toEqual(['Domain model1', 'Interface design1', 'Technical specification1', 'Test plan1']);
    const shared = section(/^Shared/);
    expect(within(shared).getAllByRole('link', { name: /P-VO01/ })[0]).toHaveAttribute('href', '/P-VO01');
    // One domain's flow steps use the view and the integration: they sit in its Interface design, with the specification in its Domain model.
    await openApp('/P-D', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    expect(kindHeadings('Interface design')).toEqual(['Views1', 'Endpoints2', 'Integrations1']);
    expect(kindHeadings('Domain model')).toContain('Specifications1');
    expect(within(section(/^Views/)).getByRole('link', { name: /P-V01/ })).toBeInTheDocument();
    const folders = ownerFolders(modelIndex(), 'P-D').stages.flatMap((s) => s.folders);
    expect(folders.find((f) => f.kind === 'specification')?.records.map((r) => r.id)).toEqual(['P-D-SP01']);
  });

  it("LA-V91-R06-T01 A domain's Technical specification lists its records by technical kind in the plan's order, each with what it names in code", async () => {
    await openApp('/P-D', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    const kinds = kindHeadings('Technical specification').map((h) => h!.replace(/\d+$/, ''));
    const order = ['Repositories', 'Data models', 'Tables', 'Value types', 'Rules', 'Predicates', 'Event types', 'Projections', 'Command handlers', 'Query handlers', 'Event handlers', 'Services', 'UI components', 'Endpoint handlers', 'Adapters'];
    expect(kinds.length).toBeGreaterThan(3);
    expect(kinds).toEqual(order.filter((k) => kinds.includes(k)));
    // Each row says what it names in code: its file, or a table its name.
    expect(within(section(/^Repositories/)).getByText('src/loans.ts')).toBeInTheDocument();
    expect(within(section(/^Tables/)).getAllByText('loans').length).toBeGreaterThan(0);
  });

  it("LA-V91-R07-T01 A domain's Test plan lists its tests by test kind in the plan's order, each with its run by", async () => {
    await openApp('/P-D', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    const kinds = kindHeadings('Test plan').map((h) => h!.replace(/\d+$/, ''));
    const order = ['Constraint tests', 'Invariant tests', 'Specification tests', 'Policy tests', 'Domain service tests', 'Use case tests', 'View tests', 'Endpoint tests', 'Flow tests', 'Integration tests', 'Pattern rule tests'];
    expect(kinds.length).toBeGreaterThan(1);
    expect(kinds).toEqual(order.filter((k) => kinds.includes(k)));
    // Each test with its level, its file when automated, and its state.
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(section(/^Use case tests/).textContent).toContain('service · test/basket.test.tsautomated');
    expect(section(/^Invariant tests/).textContent).toContain('unitnot automated yet');
  });

  it('LA-V91-R08-T01 The domain page heads Technical specification and Test plan with the nav\'s kind folders, in its order', async () => {
    const { user, folders } = await shoppingUnfolded();
    await user.click(head(folders, /^Technical specification/));
    await user.click(head(folders, /^Test plan/));
    const navKinds = [...rows(list('Technical specification of Shopping')), ...rows(list('Test plan of Shopping'))];
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect([...kindHeadings('Technical specification'), ...kindHeadings('Test plan')]).toEqual(navKinds);
  });

  it("LA-V91-R08-T02 A stage's group page of tests reads them in the same kind groups", async () => {
    await openApp('/DM-SHOP/test-plan');
    await screen.findByRole('heading', { level: 1, name: 'Test plan (2)' });
    expect([...main().querySelectorAll('h2')].map((h) => h.textContent).filter((t) => /tests/.test(t!))).toEqual(['Invariant tests1', 'Use case tests1']);
  });

  it('LA-V91-R09-T01 An endpoint sits in its domain\'s Interface design and an integration in the one domain that uses it, by their stage', () => {
    const index = modelIndex();
    const folders = ownerFolders(index, 'P-D').stages;
    const design = folders.find((s) => s.label === 'Interface design')!;
    expect(design.folders.filter((f) => f.count > 0).map((f) => [f.kind, f.records.map((r) => r.id)])).toEqual([
      ['view', ['P-V01']], ['endpoint', ['P-D-EP01', 'P-D-EP02']], ['integration', ['P-INT01']],
    ]);
    // The graph places them the same: in the stage's kind folders.
    expect(treeParent(index, 'P-D-EP01')).toBe('P-D/interface-design/endpoint');
    expect(treeParent(index, 'P-INT01')).toBe('P-D/interface-design/integration');
    expect(treeChildren(index, 'P-D/interface-design')).toContain('P-D/interface-design/integration');
  });
});
