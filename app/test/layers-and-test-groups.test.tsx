import './graph/setup';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { graphMap } from '../src/graph/map';
import { neighborhood } from '../src/graph/model';
import { indexWorkspace } from '../src/specs/data';
import { branchOf, domainFolders, type Folder, type FolderGroup } from '../src/specs/folders';
import { layerWorkspace } from './fixtures/layers';
import { workspace } from './fixtures/workspace';
import { main, openApp, openSideBar } from './helpers';

// Technical specification lists a domain's layers in order, each holding its components, then the
// components outside any layer; Test plan groups its tests by what they prove (computed, not
// stored). The side nav, the domain page and the group pages read the one folder model.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const list = (name: string) => within(panel()).getByRole('list', { name });
const findList = (name: string) => within(panel()).findByRole('list', { name });
/** The rows directly in a nav list, as "Label count": folder buttons and layer links alike. */
const rows = (el: HTMLElement) => [...el.querySelectorAll(':scope > li > .nav-folder-head, :scope > li > .nav-row > a')].map((b) => b.textContent);
const head = (el: HTMLElement, name: RegExp) => within(el).getAllByRole('button', { name }).find((b) => b.closest('ul') === el)!;

const designFolder = (index: ReturnType<typeof indexWorkspace>, domain: string, section: string) =>
  domainFolders(index, domain).stages.flatMap((s) => s.folders).find((f) => f.section === section)!;
/** A folder's groups as a tree of labels, counts and record IDs. */
type Shape = { label: string; count: number; records?: string[]; groups?: Shape[] };
const shape = (groups: FolderGroup[]): Shape[] => groups.map((g) => ({
  label: g.label,
  count: g.count,
  ...(g.records.length > 0 ? { records: g.records.map((r) => r.id) } : {}),
  ...(g.groups.length > 0 ? { groups: shape(g.groups) } : {}),
}));
const tree = (f: Folder) => shape(f.groups);

describe('layers and test groups', () => {
  it('LA-BRW-T280 Technical specification lists the layers in their order, each with its components, then those outside any layer', () => {
    const index = indexWorkspace(layerWorkspace());
    const spec = designFolder(index, 'DM-SHOP', 'technical-specification');
    expect(tree(spec)).toEqual([
      { label: 'Models', count: 2, records: ['DM-SHOP-C02', 'DM-SHOP-C03'] },
      { label: 'Services', count: 1, records: ['DM-SHOP-C04'] },
      { label: 'Web app', count: 1, records: ['DM-SHOP-C05'] },
      { label: 'Components outside any layer', count: 1, records: ['DM-SHOP-C01'] },
    ]);
    // A layer's group is the layer itself; the outside group is no record.
    expect(spec.groups.map((g) => g.record?.id ?? null)).toEqual(['DM-SHOP-LAY02', 'DM-SHOP-LAY03', 'DM-SHOP-LAY01', null]);
    // The folder counts its components, not its layers.
    expect(spec.count).toBe(5);

    // A domain with no layers lists its components as before.
    const plain = designFolder(indexWorkspace(workspace()), 'DM-SHOP', 'technical-specification');
    expect(plain.groups).toEqual([]);
    expect(plain.records.map((r) => r.id)).toEqual(['DM-SHOP-C01']);
    expect(plain.count).toBe(1);
  });

  it('LA-BRW-T281 Test plan groups each test by family, then by what it proves: acceptance, domain rule, pattern, interaction, UI, design and engineering; empty groups are left out', () => {
    const index = indexWorkspace(layerWorkspace());
    expect(tree(designFolder(index, 'DM-SHOP', 'test-plan'))).toEqual([
      {
        label: 'Acceptance tests', count: 5, groups: [
          { label: 'Browsing', count: 1, groups: [{ label: 'Look at an item', count: 1, records: ['DM-SHOP-T03'] }] },
          // A capability's test is an acceptance test, listed in its capability when it proves no UC requirement.
          { label: 'Filling the basket', count: 3, records: ['DM-SHOP-T09'], groups: [{ label: 'Empty the basket', count: 2, records: ['DM-SHOP-T02', 'DM-SHOP-T04'] }] },
          { label: 'Use cases outside any capability', count: 1, groups: [{ label: 'Add an item to the basket', count: 1, records: ['DM-SHOP-T01'] }] },
        ],
      },
      { label: 'Domain rule tests', count: 1, records: ['DM-SHOP-T05'] },
      { label: 'Pattern tests', count: 1, groups: [{ label: 'Saving', count: 1, records: ['DM-SHOP-T06'] }] },
      { label: 'Interaction tests', count: 1, records: ['DM-SHOP-T13'] },
      // A view's interaction requirement is proved by a UI test, as is a test of type ui.
      { label: 'UI tests', count: 2, records: ['DM-SHOP-T07', 'DM-SHOP-T10'] },
      // A test of type design, and one whose links only support, are design checks.
      { label: 'Design checks', count: 2, records: ['DM-SHOP-T11', 'DM-SHOP-T12'] },
      { label: 'Engineering checks', count: 1, records: ['DM-SHOP-T08'] },
    ]);
    // Only one group has tests: no group level, so the tests are listed directly.
    const pay = designFolder(index, 'DM-PAY', 'test-plan');
    expect(pay.groups).toEqual([]);
    expect(pay.records.map((r) => r.id)).toEqual(['DM-PAY-T01']);
    // Only acceptance tests: the group level goes, the use cases stay (and with no use case in a
    // capability, the tests go straight into their use cases).
    expect(tree(designFolder(indexWorkspace(workspace()), 'DM-SHOP', 'test-plan'))).toEqual([
      { label: 'Add an item to the basket', count: 1, records: ['DM-SHOP-T01'] },
    ]);
  });

  it('LA-BRW-T282 In the nav, layers are foldable rows that link to their pages, and test groups are rows that only fold, each with its count', async () => {
    await openApp('/DM', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    await user.click(head(list('Folders of Shopping'), /^Design/));
    expect(rows(list('Design of Shopping'))).toEqual(['Interaction design3', 'Technical specification5', 'Test plan13']);

    // One level: the layers, folded, then the components outside any layer.
    await user.click(head(list('Design of Shopping'), /^Technical specification/));
    const spec = list('Technical specification of Shopping');
    expect(rows(spec)).toEqual(['Models2', 'Services1', 'Web app1', 'Components outside any layer1']);
    expect(within(spec).getByRole('link', { name: /^Models/ })).toHaveAttribute('href', '/DM-SHOP-LAY02');
    expect(within(panel()).queryByRole('list', { name: 'Models of Shopping' })).toBeNull();
    await user.click(within(spec).getByRole('button', { name: 'Unfold Models' }));
    expect(within(list('Models of Shopping')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-C02', '/DM-SHOP-C03']);

    // Test groups are buttons that fold, not links.
    await user.click(head(list('Design of Shopping'), /^Test plan/));
    const plan = list('Test plan of Shopping');
    expect(rows(plan)).toEqual(['Acceptance tests5', 'Domain rule tests1', 'Pattern tests1', 'Interaction tests1', 'UI tests2', 'Design checks2', 'Engineering checks1']);
    expect(within(plan).queryAllByRole('link')).toEqual([]);
    await user.click(head(plan, /^Acceptance tests/));
    expect(rows(list('Acceptance tests of Shopping'))).toEqual(['Browsing1', 'Filling the basket3', 'Use cases outside any capability1']);
    await user.click(head(list('Acceptance tests of Shopping'), /^Filling the basket/));
    await user.click(head(list('Filling the basket of Shopping'), /^Empty the basket/));
    expect(within(list('Empty the basket of Shopping')).getAllByRole('link').map((a) => a.textContent)).toEqual(['Emptying a basket clears it', 'A priced item can be emptied out']);
  });

  it("LA-BRW-T283 The current page's branch opens through its layer or its test groups", async () => {
    const index = indexWorkspace(layerWorkspace());
    const spec = 'DM-SHOP/design/technical-specification';
    const plan = 'DM-SHOP/design/test-plan';
    expect(branchOf(index, 'DM-SHOP-C04')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', spec, `${spec}/DM-SHOP-LAY03`]);
    expect(branchOf(index, 'DM-SHOP-LAY03')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', spec, `${spec}/DM-SHOP-LAY03`]);
    expect(branchOf(index, 'DM-SHOP-C01')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', spec, `${spec}/outside`]);
    expect(branchOf(index, 'DM-SHOP-T04')).toEqual(['domain:DM-SHOP', 'DM-SHOP/design', plan, `${plan}/acceptance`, `${plan}/acceptance/DM-SHOP-CAP01`, `${plan}/acceptance/DM-SHOP-CAP01/DM-SHOP-UC02`]);

    await openApp('/DM-SHOP-C04', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checkout service' });
    expect(within(await findList('Services of Shopping')).getByRole('link', { name: 'Checkout service' })).toHaveAttribute('aria-current', 'page');

    // A layer's page marks its row and opens it.
    await openApp('/DM-SHOP-LAY02', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Models' });
    await findList('Models of Shopping');
    expect(within(list('Technical specification of Shopping')).getByRole('link', { name: /^Models/ })).toHaveAttribute('aria-current', 'page');

    await openApp('/DM-SHOP-T05', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'A basket stops at 50 items' });
    expect(within(await findList('Domain rule tests of Shopping')).getByRole('link', { name: 'A basket stops at 50 items' })).toHaveAttribute('aria-current', 'page');
    expect(within(panel()).queryByRole('list', { name: 'Acceptance tests of Shopping' })).toBeNull();
  });

  it('LA-BRW-T284 The domain page heads the same layers and test groups, layers linking to their pages, with rows folded one level deep', async () => {
    await openApp('/DM-SHOP', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const user = userEvent.setup();
    const folder = (name: RegExp) => within(main()).getByRole('heading', { level: 3, name }).closest('section') as HTMLElement;
    const texts = (el: HTMLElement, level: string) => [...el.querySelectorAll(level)].map((h) => h.firstChild?.textContent);

    const spec = folder(/^Technical specification/);
    expect(within(spec).getByRole('heading', { level: 3 })).toHaveTextContent('Technical specification5');
    expect(texts(spec, 'h4')).toEqual(['Models', 'Services', 'Web app', 'Components outside any layer']);
    expect(within(spec).getByRole('link', { name: 'Models' })).toHaveAttribute('href', '/DM-SHOP-LAY02');
    const models = within(spec).getByRole('heading', { level: 4, name: /^Models/ }).closest('section') as HTMLElement;
    expect([...models.querySelectorAll('a.record-link code')].map((c) => c.textContent)).toEqual(['DM-SHOP-C02', 'DM-SHOP-C03']);

    const plan = folder(/^Test plan/);
    expect(texts(plan, 'h4')).toEqual(['Acceptance tests', 'Domain rule tests', 'Pattern tests', 'Interaction tests', 'UI tests', 'Design checks', 'Engineering checks']);
    expect(texts(plan, 'h5')).toEqual(['Browsing', 'Filling the basket', 'Use cases outside any capability', 'Saving']);
    expect(texts(plan, 'h6')).toEqual(['Look at an item', 'Empty the basket', 'Add an item to the basket']);
    // Test groups are not records: their headings are not links.
    expect(within(plan).queryByRole('link', { name: 'Acceptance tests' })).toBeNull();

    // A capability in the Capabilities folder still folds its use cases one level deep.
    const filling = within(folder(/^Capabilities/)).getByRole('link', { name: /^DM-SHOP-CAP01/ }).closest('li') as HTMLElement;
    expect(filling.querySelector('ul.nested')).toBeNull();
    await user.click(within(filling).getByRole('button', { name: 'Expand DM-SHOP-CAP01' }));
    expect(filling.querySelector('ul.nested')).not.toBeNull();

    // Filtering keeps only the groups that hold a match.
    await user.type(screen.getByLabelText('Filter records'), 'checkout');
    expect(texts(folder(/^Technical specification/), 'h4')).toEqual(['Services']);
    expect(within(folder(/^Test plan/)).getByText('Nothing matches.')).toBeInTheDocument();
  });

  it("LA-BRW-T285 A layer's record page lists its components as its children, as a capability's lists its own", async () => {
    await openApp('/DM-SHOP-LAY02', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Models' });
    expect(main().querySelector('.eyebrow')).toHaveTextContent('Demo shop · Shopping · Layer');
    const children = within(main()).getByRole('heading', { level: 2, name: /^Components/ });
    expect(children).toHaveTextContent('Components2');
    const listed = children.closest('section') as HTMLElement;
    expect([...listed.querySelectorAll('a.record-link code')].map((c) => c.textContent)).toEqual(['DM-SHOP-C02', 'DM-SHOP-C03']);
  });

  it('LA-BRW-T286 In the graph a domain reaches its components through Design, Technical specification, then a layer, one level each, read left to right', async () => {
    const index = indexWorkspace(layerWorkspace());
    // Depth 1 from the domain: its product and its stages; their folders are the next level, one more down.
    const domain = neighborhood(index, 'DM-SHOP', 1);
    const framed = domain.nodes.map((n) => n.id);
    expect(framed).toContain('DM-SHOP/design');
    expect(framed).toContain('DM');
    expect(framed).not.toContain('DM-SHOP/design/technical-specification');
    expect(neighborhood(index, 'DM-SHOP', 2).nodes.find((n) => n.id === 'DM-SHOP/design/technical-specification')).toMatchObject({ title: expect.stringMatching(/^Technical specification \(\d+\)$/) });
    expect(framed.filter((id) => id.startsWith('DM-SHOP-LAY') || id.startsWith('DM-SHOP-C0'))).toEqual([]);
    expect(domain.edges.every((e) => e.relation === 'parent')).toBe(true);

    // Depth 3 reaches the layers, Technical specification's records, in order; a layer's components would be the next level.
    const walk = neighborhood(index, 'DM-SHOP', 3);
    const column = new Map(walk.nodes.map((n) => [n.id, n.column]));
    expect(['DM', 'DM-SHOP', 'DM-SHOP/design', 'DM-SHOP/design/technical-specification', 'DM-SHOP-LAY02'].map((id) => column.get(id))).toEqual([0, 1, 2, 3, 4]);
    for (const id of ['DM-SHOP-LAY01', 'DM-SHOP-LAY03']) expect(column.get(id)).toBe(column.get('DM-SHOP-LAY02'));
    expect(walk.nodes.find((n) => n.id === 'DM-SHOP-C02')).toBeUndefined();

    // From a layer at depth 1: Technical specification to its left, its components to its right.
    const layer = neighborhood(index, 'DM-SHOP-LAY02', 1);
    const lc = new Map(layer.nodes.map((n) => [n.id, n.column]));
    expect(layer.nodes.map((n) => n.id).sort()).toEqual(['DM-SHOP-C02', 'DM-SHOP-C03', 'DM-SHOP-LAY02', 'DM-SHOP/design/technical-specification']);
    expect([lc.get('DM-SHOP/design/technical-specification'), lc.get('DM-SHOP-LAY02'), lc.get('DM-SHOP-C02')]).toEqual([0, 1, 2]);
    // In the one map, one level after another, left to right.
    const map = graphMap(index);
    const x = (id: string) => map.nodes.get(id)!.x;
    expect(x('DM-SHOP/design/technical-specification')).toBeLessThan(x('DM-SHOP-LAY02'));
    expect(x('DM-SHOP-LAY02')).toBeLessThan(x('DM-SHOP-C02'));
    expect(x('DM-SHOP-C03')).toBe(x('DM-SHOP-C02'));
  });

  it("LA-BRW-T287 A group page of tests reads them in the test plan's groups", async () => {
    await openApp('/DM-SHOP/design/test-plan', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: /^Test plan/ });
    const members = within(main()).getByRole('heading', { level: 2, name: /^Tests/ }).closest('section') as HTMLElement;
    // The domain's own tests (not the capability's) in their groups.
    expect([...members.querySelectorAll('h3')].map((h) => h.firstChild?.textContent)).toEqual(['Acceptance tests', 'Domain rule tests', 'Pattern tests', 'Interaction tests', 'UI tests', 'Design checks', 'Engineering checks']);
    const engineering = within(members).getByRole('heading', { level: 3, name: /^Engineering checks/ }).closest('section') as HTMLElement;
    expect([...engineering.querySelectorAll('a.record-link code')].map((c) => c.textContent)).toEqual(['DM-SHOP-T08']);
  });

  it('LA-BRW-T288 Group labels name kinds through plural(), and what is folded in a group lasts for the session', async () => {
    const w = layerWorkspace();
    w.kinds = w.kinds.map((k) => (k.kind === 'component' ? { ...k, label: 'Part' } : k.kind === 'use_case' ? { ...k, label: 'Story' } : k));
    const index = indexWorkspace(w);
    expect(designFolder(index, 'DM-SHOP', 'technical-specification').groups.at(-1)?.label).toBe('Parts outside any layer');
    expect(designFolder(index, 'DM-SHOP', 'test-plan').groups[0].groups.at(-1)?.label).toBe('Stories outside any capability');

    await openApp('/DM-SHOP-C02', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Basket model' });
    await findList('Models of Shopping');
    await waitFor(() => expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('DM-SHOP/design/technical-specification/DM-SHOP-LAY02'));
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();
  });

  it('LA-BRW-T289 In the graph a capability with 7 use cases shows them directly, with no folder', () => {
    const w = layerWorkspace();
    for (let i = 4; i <= 8; i++) {
      w.records.push({ id: `DM-SHOP-UC0${i}`, kind: 'use_case', title: `Browse ${i}`, parent: 'DM-SHOP-CAP02', product: 'DM', domain: 'DM-SHOP', fields: { actor: 'Shopper' }, body: '', path: `specs/dm/DM-SHOP-UC0${i}.md`, mentions: [] });
    }
    w.records.push({ id: 'DM-SHOP-UC09', kind: 'use_case', title: 'Browse 9', parent: 'DM-SHOP-CAP02', product: 'DM', domain: 'DM-SHOP', fields: { actor: 'Shopper' }, body: '', path: 'specs/dm/DM-SHOP-UC09.md', mentions: [] });
    const index = indexWorkspace(w);
    expect((index.children.get('DM-SHOP-CAP02') ?? []).length).toBe(7);
    const n = neighborhood(index, 'DM-SHOP-CAP02', 1);
    expect(n.nodes.some((x) => x.group && x.group.parent === 'DM-SHOP-CAP02')).toBe(false);
    const spine = n.edges.filter((e) => e.relation === 'parent' && e.source === 'DM-SHOP-CAP02').map((e) => e.target).sort();
    expect(spine).toEqual(['DM-SHOP-UC03', 'DM-SHOP-UC04', 'DM-SHOP-UC05', 'DM-SHOP-UC06', 'DM-SHOP-UC07', 'DM-SHOP-UC08', 'DM-SHOP-UC09']);
    // A layer points straight at its components too.
    expect(neighborhood(index, 'DM-SHOP-LAY02', 1).edges.map((e) => `${e.source} > ${e.target}`)).toEqual(expect.arrayContaining(['DM-SHOP-LAY02 > DM-SHOP-C02', 'DM-SHOP-LAY02 > DM-SHOP-C03']));
  });

  it('LA-BRW-T290 A split by kind or by test group appears only when there is more than one to tell apart', async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    const user = userEvent.setup();
    // Test plan with one group (DM-PAY: an engineering check only): its tests are listed directly, in the nav and on the domain page.
    await openApp('/DM-PAY', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    await user.click(head(list('Folders of Paying'), /^Design/));
    await user.click(head(list('Design of Paying'), /^Test plan/));
    expect(within(list('Test plan of Paying')).getByRole('link', { name: 'The payment module builds' })).toHaveAttribute('href', '/DM-PAY-T01');
    const payPlan = within(main()).getByRole('heading', { level: 3, name: /^Test plan/ }).closest('section') as HTMLElement;
    expect(payPlan.querySelector('h4')).toBeNull();

    // Only acceptance tests: no Acceptance tests level, but the use case level (a record) stays.
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    await user.click(head(list('Folders of Shopping'), /^Design/));
    await user.click(head(list('Design of Shopping'), /^Test plan/));
    expect(rows(list('Test plan of Shopping'))).toEqual(['Add an item to the basket1']);
    const plan = within(main()).getByRole('heading', { level: 3, name: /^Test plan/ }).closest('section') as HTMLElement;
    expect([...plan.querySelectorAll('h4')].map((h) => h.firstChild?.textContent)).toEqual(['Add an item to the basket']);
    // A folder of one kind has no heading per kind; one of several kinds has.
    expect(within(main()).getByRole('heading', { level: 3, name: /^Domain model/ }).closest('section')!.querySelector('h4')).toBeNull();
    expect(within(main()).getByRole('heading', { level: 3, name: /^Interaction design/ }).closest('section')!.querySelectorAll('h4')).toHaveLength(3);

    // Children of one kind carry no kind tag; children of several kinds do.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const ucChildren = within(main()).getByRole('heading', { level: 2, name: /^UC requirements/ }).closest('section') as HTMLElement;
    expect(within(ucChildren).queryByText('UC requirement', { selector: 'small' })).toBeNull();
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    // A product's children are listed in the side bar of its one page.
    const productChildren = within(screen.getByRole('complementary', { name: 'Side bar' })).getByRole('list', { name: 'Children' });
    expect(within(productChildren).getAllByText('Domain', { selector: 'small' }).length).toBeGreaterThan(0);
  });

  it("LA-BRW-T291 In the graph a domain's Test plan folder holds the test plan's groups, from the same folder model, each a group node that opens", async () => {
    const index = indexWorkspace(layerWorkspace());
    const plan = 'DM-SHOP/design/test-plan';
    const acceptance = `${plan}/acceptance`;
    // Depth 1 from the Test plan: the Design stage and the groups, labeled with their counts.
    const folder = neighborhood(index, plan, 1);
    const titles = Object.fromEntries(folder.nodes.filter((x) => x.group && x.id !== plan && x.id !== 'DM-SHOP/design').map((x) => [x.id, x.title]));
    expect(titles).toEqual({
      // The capability's own test is listed here too, under its capability, as the nav lists it.
      [acceptance]: 'Acceptance tests (5)',
      [`${plan}/domain-rules`]: 'Domain rule tests (1)',
      [`${plan}/patterns`]: 'Pattern tests (1)',
      [`${plan}/interaction`]: 'Interaction tests (1)',
      [`${plan}/ui`]: 'UI tests (2)',
      [`${plan}/design`]: 'Design checks (2)',
      [`${plan}/engineering`]: 'Engineering checks (1)',
    });
    expect(folder.nodes.filter((x) => !x.group).map((x) => x.id)).toEqual([]);

    // A test's place in the map: the Test plan, then acceptance, its capability and its use case, one level each, left to right.
    const placed = graphMap(index).nodes;
    const path = [plan, acceptance, `${acceptance}/DM-SHOP-CAP01`, `${acceptance}/DM-SHOP-CAP01/DM-SHOP-UC02`, 'DM-SHOP-T04'];
    expect(path.map((id) => placed.get(id)!.level)).toEqual(path.map((_, i) => placed.get(plan)!.level + i));
    for (let i = 1; i < path.length; i++) expect(placed.get(path[i])!.parent).toBe(path[i - 1]);
    // From the test, its use case's group is the parent the camera keeps at the left edge.
    expect(neighborhood(index, 'DM-SHOP-T04', 3).edges.map((e) => `${e.source} > ${e.target}`)).toContain(`${path[3]} > DM-SHOP-T04`);
    for (let i = 1; i < path.length; i++) expect(placed.get(path[i - 1])!.x).toBeLessThan(placed.get(path[i])!.x);

    // Every graph group is the Test plan folder's group, by its key and label.
    const folderModel = designFolder(index, 'DM-SHOP', 'test-plan');
    expect(folderModel.groups.map((g) => g.label).sort()).toEqual(Object.values(titles).map((t) => t.replace(/ \(\d+\)$/, '')).sort());
    expect(Object.keys(titles).sort()).toEqual(folderModel.groups.map((g) => g.key).sort());

    // With one test group only, the tests hang straight under the Test plan.
    const pay = neighborhood(index, 'DM-PAY-T01', 1);
    expect(pay.edges.map((e) => `${e.source} > ${e.target}`)).toEqual(['DM-PAY/design/test-plan > DM-PAY-T01']);

    // A test-plan group has its own page.
    await openApp(`/${acceptance}`, { workspace: layerWorkspace() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Acceptance tests (5)' })).toBeInTheDocument();
  });

  it('LA-BRW-T292 The graph trail names each record by its title with its ID in parentheses, and a group by its name alone', async () => {
    const trail = () => within(screen.getByRole('navigation', { name: 'Records visited' }));
    const w = layerWorkspace();
    w.records.find((r) => r.id === 'DM-SHOP-LAY02')!.title = 'Models, entities, value objects and every other kind of stored record';
    await openApp('/DM-SHOP-LAY02?view=graph', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: /^Models, entities/ });
    const item = await waitFor(() => trail().getByText(/^Models, entities/).closest('.trail-item') as HTMLElement);
    // The current item: its name (bold, cut short by CSS), the ID in code style, the full text as its tooltip.
    expect(item).toHaveAttribute('aria-current', 'page');
    expect(item.textContent).toBe('Models, entities, value objects and every other kind of stored record (DM-SHOP-LAY02)');
    expect(item).toHaveAttribute('title', item.textContent);
    expect(item.querySelector('.trail-name')).not.toBeNull();
    expect(item.querySelector('code.trail-id')).toHaveTextContent('(DM-SHOP-LAY02)');

    // A test-plan group's page: its name, with no count and no ID of its own; its parent in the tooltip.
    await openApp('/DM-SHOP/design/test-plan/acceptance?view=graph', { workspace: layerWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Acceptance tests (5)' });
    const group = await waitFor(() => trail().getByText('Acceptance tests').closest('.trail-item') as HTMLElement);
    expect(group.textContent).toBe('Acceptance tests');
    expect(group).toHaveAttribute('title', 'Acceptance tests of DM-SHOP');
  });
});
