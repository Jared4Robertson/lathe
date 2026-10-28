import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { KindDescription } from '../../lathe/src/store/schema';
import { branchOf, domainFolders, folderPath, ownerFolders, productFolders } from '../src/specs/folders';
import { treeChildren } from '../src/graph/tree';
import { isGraphNode } from '../src/graph/model';
import { workspace } from './fixtures/workspace';
import { modelIndex } from './fixtures/model';
import { patternWorkspace } from './fixtures/patterns';
import { main, openApp, stageOf } from './helpers';
import { addRows, indexOf } from './fixtures/load';

// The side nav and the domain page read in the five stages: what the product shares in its own
// stages (Shared), and in each domain its Domain model, Use cases, Interaction design, Technical
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
  parents: [{ kind: 'domain', column: 'domain_id' }], supertypes: [], titleForm: null,
});

describe('folders by stage', () => {
  /** The space's page with Shopping unfolded into its stages. */
  const shoppingUnfolded = async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    return { user, folders: list('Folders of Shopping') };
  };

  it('LA-V90-R16-T01 Under the space, one level shows: domains are folded rows, and a domain unfolds into its stages and open questions with counts', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    // One level: the domains, each folded.
    expect(within(panel()).getByRole('button', { name: 'Unfold Shopping' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).queryByRole('list', { name: 'Folders of Shopping' })).toBeNull();

    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    expect(rows(list('Folders of Shopping'))).toEqual(['Domain model4', 'Use cases1', 'Interaction design2', 'Technical specification2', 'Test plan2', 'Open questions1']);
  });

  it('LA-V90-R17-T01 Stages and folders fold one level at a time, with counts', async () => {
    const { user, folders } = await shoppingUnfolded();
    // Each stage folds on its own and opens one level: its folders, one per kind, still folded.
    await user.click(head(folders, /^Domain model/));
    expect(rows(list('Domain model of Shopping'))).toEqual(['Aggregates1', 'Specifications1', 'Read models1', 'Terms1']);
    expect(within(panel()).queryByRole('list', { name: 'Aggregates of Shopping' })).toBeNull();
    await user.click(head(folders, /^Interaction design/));
    expect(rows(list('Interaction design of Shopping'))).toEqual(['Flows1', 'Endpoints1']);
    await user.click(head(list('Interaction design of Shopping'), /^Endpoints/));
    expect(within(list('Endpoints of Shopping')).getAllByRole('link').map((a) => a.textContent)).toEqual(['POST /basket/items']);
    await user.click(head(folders, /^Open questions/));
    expect(within(list('Open questions of Shopping')).getByRole('link', { name: 'What happens to a basket overnight?' })).toHaveAttribute('href', '/DM-SHOP-Q01');

    // Folding a stage hides its folders.
    await user.click(head(folders, /^Interaction design/));
    expect(within(panel()).queryByRole('list', { name: 'Interaction design of Shopping' })).toBeNull();
  });

  it('LA-V90-R17-T02 A stage or folder with no records is left out of the nav', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Paying' }));
    // Paying has an aggregate, a use case and its flow, and nothing built or tested yet: no Technical specification, no Test plan.
    expect(rows(list('Folders of Paying'))).toEqual(['Domain model1', 'Use cases1', 'Interaction design1']);
    // Its Interaction design lists Flows and leaves out the endpoints it has none of.
    await user.click(head(list('Folders of Paying'), /^Interaction design/));
    expect(rows(list('Interaction design of Paying'))).toEqual(['Flows1']);
  });

  it("LA-EXP-DS03-T01 The current page's branch opens itself: a record's domain, stage and folder, or a group's folder", async () => {
    // A UC requirement is not listed; the capability it sits under is, so that capability's branch opens (Use cases
    // holds only capabilities, so they are listed in the stage itself).
    await openApp('/DM-SHOP-UC01-R01');
    await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' });
    expect(within(await findList('Use cases of Shopping')).getByRole('link', { name: 'Buying' })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    expect(within(panel()).queryByRole('list', { name: 'Interaction design of Shopping' })).toBeNull();
  });

  it("LA-V90-R18-T01 The current page's branch opens itself: a record's domain, stage and folder, and a domain page its domain", async () => {
    await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'addToBasket' });
    expect(within(await findList('Command handlers of Shopping')).getByRole('link', { name: 'addToBasket' })).toHaveAttribute('aria-current', 'page');

    // The domain page opens its domain.
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(await within(panel()).findByRole('button', { name: 'Fold Paying' })).toHaveAttribute('aria-expanded', 'true');
    expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('domain:DM-PAY');
  });

  it('LA-V91-R05-T01 A group page opens the folder of its kind, and names its stage as the nav does', async () => {
    await openApp('/DM-SHOP/interaction-design/endpoint');
    await screen.findByRole('heading', { level: 1, name: /^Endpoints/ });
    expect(within(await findList('Endpoints of Shopping')).getByRole('link', { name: 'POST /basket/items' })).toBeInTheDocument();
    expect(main().querySelector('.group-folder')).toHaveTextContent('Interaction design');
  });

  /** Shopping's page, with Test plan renamed and put first in the schema. */
  const renamedStage = async () => {
    const w = workspace();
    w.schema.stages = w.schema.stages.map((s) => (s.name === 'test-plan' ? { ...s, label: 'Tests and checks', position: 0 } : s));
    await openApp('/DM-SHOP', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
  };

  it('LA-EXP-DS03-T02 Stage names and order come from the schema, in the nav', async () => {
    await renamedStage();
    expect(rows(await findList('Folders of Shopping'))).toEqual(['Tests and checks2', 'Domain model4', 'Use cases1', 'Interaction design2', 'Technical specification2', 'Open questions1']);
  });

  it('LA-V91-R05-T02 The domain page heads its records with the same stages as the nav', async () => {
    await renamedStage();
    expect([...main().querySelectorAll('h2.stage-title')].map((h) => h.childNodes[1]?.textContent)).toEqual(['Tests and checks', 'Domain model', 'Use cases', 'Interaction design', 'Technical specification']);
  });

  it('LA-V90-R16-T02 The product shows Shared only when it holds anything, before its domains', async () => {
    await openApp('/DM', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // One Shared folder before the domains holds the product's own stages, as the graph's tree has it.
    expect(rows(list('Shared in Demo shop'))).toEqual(['Shared5']);
    const user = userEvent.setup();
    await user.click(head(list('Shared in Demo shop'), /^Shared/));
    const own = list('Stages of Demo shop');
    // A pattern rule test sits under its rule, in Shared too.
    expect(rows(own)).toEqual(['Domain model1', 'Use cases1', 'Interaction design2', 'Test plan1']);
    // Shared's Use cases holds only patterns, so it lists them itself.
    await user.click(head(own, /^Use cases/));
    expect(within(list('Use cases of Demo shop')).getByRole('link', { name: 'Audited action' })).toHaveAttribute('href', '/DM-PAT-AUDIT');
    // The product's open questions are a group of their own.
    expect(within(list('Groups of Demo shop')).getByRole('link', { name: /Open questions/ })).toHaveAttribute('href', '/DM/question');

    // Notebook shares nothing.
    await openApp('/NF');
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    expect(within(panel()).queryByRole('list', { name: 'Shared in Notebook' })).toBeNull();
  });

  it("LA-V90-R18-T02 A pattern rule's page opens the product's own Use cases", async () => {
    await openApp('/DM-PAT-AUDIT-R01', { data: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Each change is recorded' });
    expect(within(await findList('Use cases of Demo shop')).getByRole('link', { name: 'Audited action' })).toBeInTheDocument();
  });

  /** The demo shop with a second use case under the capability, and its flow. */
  const twoUseCases = () => {
    const w = workspace();
    addRows(w, 'use_case', { id: 'DM-SHOP-UC02', title: 'Empty the basket', capability_id: 'DM-SHOP-CAP01' });
    addRows(w, 'flow', { id: 'DM-SHOP-UC02-FL01', title: 'Empty a basket', use_case_id: 'DM-SHOP-UC02' });
    return w;
  };

  it("LA-EXP-DS03-T03 A record is listed in its stage's folder when its parent is of another stage, and folds under its parent in the same stage", () => {
    const w = twoUseCases();
    const index = indexOf(w);
    const { stages, loose } = domainFolders(index, 'DM-SHOP');
    const ids = Object.fromEntries(stages.flatMap((s) => s.folders).filter((f) => f.count > 0).map((f) => [f.kind, f.records.map((r) => r.id)]));
    expect(ids).toEqual({
      aggregate: ['DM-SHOP-A1'],
      specification: ['DM-SHOP-SP01'],
      read_model: ['DM-SHOP-RM01'],
      term: ['DM-SHOP-TM01'],
      capability: ['DM-SHOP-CAP01'],
      flow: ['DM-SHOP-UC01-FL01', 'DM-SHOP-UC02-FL01'],
      endpoint: ['DM-SHOP-EP01'],
      table: ['DM-SHOP-EN01-TB'],
      command_handler: ['DM-SHOP-CMD01-H'],
      invariant_test: ['DM-SHOP-INV01-T'],
      use_case_test: ['DM-SHOP-UC01-R01-T01'],
    });
    expect(loose.map((f) => [f.label, f.records.map((r) => r.id)])).toEqual([['Open questions', ['DM-SHOP-Q01']]]);
    // A use case folds under its capability, in Use cases (which lists its capabilities itself, with no folder); a
    // command under its aggregate, in Domain model.
    expect(branchOf(index, 'DM-SHOP-UC02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/use-cases']);
    expect(branchOf(index, 'DM-SHOP-CMD01')).toEqual(['domain:DM-SHOP', 'DM-SHOP/domain-model', 'DM-SHOP/domain-model/aggregate']);
    // A flow step folds under its flow, in Interaction design.
    expect(branchOf(index, 'DM-SHOP-UC01-FL01-S02')).toEqual(['domain:DM-SHOP', 'DM-SHOP/interaction-design', 'DM-SHOP/interaction-design/flow']);
    // In Shared: a constraint folds under its value object, which both domains use (Shared's Domain model holds only
    // value objects, so lists them itself); so does the view.
    expect(branchOf(index, 'DM-VO01-C01')).toEqual(['DM/shared', 'DM/domain-model']);
    expect(productFolders(index, 'DM').stages.filter((s) => s.count > 0).map((s) => [s.label, s.folders.filter((f) => f.count > 0).map((f) => f.label)])).toEqual([
      ['Domain model', ['Value objects']],
      ['Interaction design', ['Interfaces', 'Views']],
    ]);
  });

  it("LA-V91-R05-T03 The domain page lists a capability's use cases under it, as the nav does", async () => {
    await openApp('/DM-SHOP', { data: twoUseCases() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const useCases = stageOf('use-cases');
    expect(within(useCases).getByRole('link', { name: /DM-SHOP-CAP01/ })).toBeInTheDocument();
    expect(within(useCases).queryByRole('link', { name: /DM-SHOP-UC02/ })).toBeNull();
  });

  it("LA-V90-R19-T01 Use cases lists capabilities, and a capability's use case opens its capability's branch", async () => {
    await openApp('/DM-SHOP-UC02', { data: twoUseCases() });
    await screen.findByRole('heading', { level: 1, name: 'Empty the basket' });
    await waitFor(() => expect(list('Use cases of Shopping').textContent).toBe('Buying'));
  });

  it('LA-EXP-DS03-T09 A record with no owner sits in the one domain that uses it, in its stage and folder, with what sits under it, and in Shared otherwise', () => {
    const index = modelIndex();
    // Only P-D's flow steps happen in the view and exchange with the integration, and the UI component renders that view.
    const folders = domainFolders(index, 'P-D').stages.flatMap((s) => s.folders);
    const of = (kind: string) => folders.find((f) => f.kind === kind)?.records.map((r) => r.id);
    expect(of('view')).toEqual(['P-V01']);
    expect(of('integration')).toEqual(['P-INT01']);
    expect(of('ui_component')).toEqual(['P-UI01']);
    expect(of('adapter')).toEqual(['P-INT01-AD']);
    expect(branchOf(index, 'P-V01')).toEqual(['domain:P-D', 'P-D/interaction-design', 'P-D/interaction-design/view']);
    // Both domains have fields typed by the value object, so the product shares it, with its constraint and value type.
    expect(of('value_object')).toBeUndefined();
    expect(branchOf(index, 'P-VO01')).toEqual(['P/shared', 'P/domain-model']);
    expect(index.byId.get('P-VO01-C01')?.domain).toBeNull();
    expect(productFolders(index, 'P').stages.flatMap((s) => s.folders).filter((f) => f.count > 0).map((f) => f.kind)).toEqual(['value_object', 'interface', 'value_type', 'constraint_test']);
  });

  it("LA-EXP-DS03-T04 A product's own kind gets its folder in its stage, or after the stages when it has no stage; the path names its stage", () => {
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

  /** Test plan of Shopping opened, then another page. */
  const testPlanOpened = async () => {
    const { user, folders } = await shoppingUnfolded();
    await user.click(head(folders, /^Test plan/));
    await openApp('/DM/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
  };

  it('LA-EXP-INV05-T What is folded is remembered for the session only', async () => {
    await testPlanOpened();
    expect(list('Test plan of Shopping')).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();
  });

  it('LA-EXP-DS03-T05 A stage lists one folder per kind, in the schema\'s order', async () => {
    await testPlanOpened();
    expect(rows(list('Test plan of Shopping'))).toEqual(['Invariant tests1', 'Use case tests1']);
  });

  const proveLaPatAppUxR15 = async () => {
    // The folder model: a stage with one folder shows that folder's records directly; with two or more it keeps them.
    const index = indexOf(patternWorkspace());
    const stage = (owner: string, name: string) => ownerFolders(index, owner).stages.find((s) => s.stage === name)!;
    expect(stage('DM-SHOP', 'use-cases').direct?.records.map((r) => r.id)).toEqual(['DM-SHOP-CAP01']);
    expect(stage('DM', 'use-cases').direct?.records.map((r) => r.id)).toEqual(['DM-PAT-AUDIT']);
    expect(stage('DM-SHOP', 'interaction-design').direct).toBeNull();
    // An empty one-folder stage is still a stage with no records.
    expect(stage('NF-NOTE', 'use-cases')).toMatchObject({ count: 0, direct: { count: 0 } });

    // The graph's tree: the stage holds the records, and the skipped folder is no group and has no address.
    expect(treeChildren(index, 'DM-SHOP/use-cases')).toEqual(['DM-SHOP-CAP01']);
    expect(treeChildren(index, 'DM/use-cases')).toEqual(['DM-PAT-AUDIT']);
    expect(isGraphNode(index, 'DM-SHOP/use-cases/capability')).toBe(false);
    expect(isGraphNode(index, 'DM/use-cases/pattern')).toBe(false);
    expect(treeChildren(index, 'DM-SHOP/interaction-design')).toEqual(['DM-SHOP/interaction-design/flow', 'DM-SHOP/interaction-design/endpoint']);
    expect(branchOf(index, 'DM-PAT-AUDIT-R01')).toEqual(['DM/shared', 'DM/use-cases']);

    // The nav: the stage's row lists the records, with no folder row between; a stage with two folders keeps them.
    const { user, folders } = await shoppingUnfolded();
    await user.click(head(folders, /^Use cases/));
    const useCases = list('Use cases of Shopping');
    expect(rows(useCases)).toEqual([]);
    expect(within(useCases).getByRole('link', { name: 'Buying' })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    await user.click(head(folders, /^Interaction design/));
    expect(rows(list('Interaction design of Shopping'))).toEqual(['Flows1', 'Endpoints1']);

    // The domain page: the stage lists the records under its own heading, with no folder heading.
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(stageOf('use-cases').querySelector('h3')).toBeNull();
    expect(within(stageOf('use-cases')).getByRole('link', { name: /DM-SHOP-CAP01/ })).toHaveAttribute('href', '/DM-SHOP-CAP01');
    await openApp('/NF-NOTE');
    await screen.findByRole('heading', { level: 1, name: 'Notes' });
    expect(within(stageOf('use-cases')).getByText('Nothing yet.')).toBeInTheDocument();

    // The skipped folder's address names nothing.
    await openApp('/DM-SHOP/use-cases/capability');
    await screen.findByText(/There's no record or group/);
  };
  it('LA-PAT-APP-UX-R15-T01 A stage with one folder lists its records directly in the folder model, the nav, the graph\'s tree and the domain page, and the folder has no address', proveLaPatAppUxR15);
  it('LA-PAT-APP-UX-R15-T02 A stage with one folder lists its records directly in the folder model, the nav, the graph\'s tree and the domain page, and the folder has no address', proveLaPatAppUxR15);
});
