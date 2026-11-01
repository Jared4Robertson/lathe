// Schema 3 to 4: essential and accidental complexity. Every kind says whether its records are essential or accidental
// complexity, so each product kind gains its complexity, given from its stage: a kind of the technical specification
// is accidental, a kind of the test plan follows the record it sits under (as-parent), and any other is essential.
// Every standard gains its type: under schema 3 a standard was a library of engineering rules, so each becomes
// engineering, and the Owner is asked to make a quality of any whose rules say what the product's people need. A
// product's settings gain the words its checks read as technology, none at first. Every interface says whether it is
// public, which makes its API requirements essential: none is at first, and the Owner is asked to mark the ones
// people or programs outside the product build on. An accidental product kind gains Lathe's pairs of provided_by,
// fills and generates, and an obligation kind the pair of provided_by, as Lathe's own kinds have them, so a product's
// declaration of one of those pairs is dropped.
//
// And a use case has one flow, the same whatever the interface (neutralFlows): its flows, one per interface under
// schema 3, merge into <use case>-FL with the union of their steps. Steps of different flows that invoke the same
// command or query, or have the same title, on the same path, are one step, with every requirement they fulfilled and
// integration they exchanged with; a step only one of several flows had becomes a variant of that flow's interface.
// Each interface offers the use cases it had a flow of (offers). A step no longer happens in a view: a view presents the
// command or query each of its steps invoked (presents), and a step that invoked nothing loses its view, as a to-do. Of
// a use case's flow tests one stays, its acceptance test (automated first, then manual, the cheapest level, the lowest
// interface); the others go, each a to-do to prove its interface once per pattern rule and domain. Flows, steps and
// tests are renamed wherever they are named, links and text alike.
import type { Converter, RawData, UpgradeNotes } from '../src/upgrade.ts';

const COMPLEXITY_BY_STAGE: Record<string, string> = { 'technical-specification': 'accidental', 'test-plan': 'as-parent' };

/** Each pair of provided_by, fills and generates a product kind now has without a declaration, as "<relation> <source> <target>". */
function accountingPairs(kinds: Record<string, unknown>[]): Set<string> {
  const pairs = new Set<string>();
  for (const k of kinds) {
    const name = String(k.name);
    const accidental = k.stage === 'technical-specification' || k.complexity === 'accidental';
    if (k.obligation === true || accidental) pairs.add(`provided_by ${name} integration`);
    if (accidental) pairs.add(`fills ${name} slot`).add(`generates tooling ${name}`);
  }
  return pairs;
}

type Raw = Record<string, unknown>;

const STATES = ['automated', 'manual', 'not automated yet'];
const LEVELS = ['unit', 'integration', 'service', 'system', 'browser'];
const rank = (list: string[], value: unknown) => (list.includes(String(value)) ? list.indexOf(String(value)) : list.length);
const escape = (id: string) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const two = (n: number) => String(n).padStart(2, '0');

/** One step of the merged flow, with the steps of the old flows it stands for. */
interface Merged {
  path: string;
  title: string;
  operation: string | null;
  /** The interfaces whose old flows had it. */
  through: Set<string>;
  sources: string[];
}

/** A use case's flows, one per interface, become its one flow; see the file's head. */
function neutralFlows(data: RawData, notes: UpgradeNotes): void {
  const flows = data.read('flow');
  if (!flows.some((f) => f.interface_id !== undefined)) return;
  const steps = data.read('flow_step');
  const tests = data.read('flow_test');
  const invokes = new Map(data.read('invokes').map((l) => [String(l.source_id), String(l.target_id)]));
  const happensIn = new Map(data.read('happens_in').map((l) => [String(l.source_id), String(l.target_id)]));
  const titleOf = new Map(data.read('use_case').map((u) => [String(u.id), String(u.title)]));
  const renamed = new Map<string, string>();
  const newFlows: Raw[] = [];
  const newSteps: Raw[] = [];
  const newTests: Raw[] = [];
  const variants = new Map<string, string>();
  const offers: Raw[] = [];
  const dropped: string[] = [];
  const viewless: string[] = [];
  const partial: string[] = [];
  const keptTests = new Set<string>();

  const byUseCase = new Map<string, Raw[]>();
  for (const f of flows) byUseCase.set(String(f.use_case_id), [...(byUseCase.get(String(f.use_case_id)) ?? []), f]);
  for (const [useCase, own] of [...byUseCase].sort(([a], [b]) => a.localeCompare(b))) {
    own.sort((a, b) => String(a.interface_id).localeCompare(String(b.interface_id)));
    const flowId = `${useCase}-FL`;
    const interfaces = own.map((f) => String(f.interface_id));
    for (const f of own) {
      renamed.set(String(f.id), flowId);
      offers.push({ source_id: f.interface_id, target_id: useCase });
    }
    newFlows.push({ id: flowId, title: titleOf.get(useCase) ?? String(own[0]!.title), use_case_id: useCase });

    // The union of the steps, path by path: each old flow's steps are matched in order, by operation or title, and a
    // step with no match goes in after the last one matched.
    const merged: Merged[] = [];
    const same = (title: string) => title.trim().toLowerCase();
    for (const f of own) {
      const face = String(f.interface_id);
      const ofFlow = steps.filter((x) => x.flow_id === f.id);
      for (const path of [...new Set(ofFlow.map((x) => String(x.path).trim()))]) {
        // The place in merged of the last step of this flow on this path, matched or put in.
        let after = -1;
        for (const s of ofFlow.filter((x) => String(x.path).trim() === path).sort((x, y) => Number(x.position) - Number(y.position))) {
          const operation = invokes.get(String(s.id)) ?? null;
          const match = merged.findIndex((m, at) => at > after && m.path === path && !m.through.has(face) && m.operation === operation && (operation !== null || same(m.title) === same(String(s.title))));
          if (match >= 0) {
            merged[match]!.through.add(face);
            merged[match]!.sources.push(String(s.id));
            after = match;
            continue;
          }
          const first = merged.findIndex((m) => m.path === path);
          const at = after >= 0 ? after + 1 : first >= 0 ? first : merged.length;
          merged.splice(at, 0, { path, title: String(s.title), operation, through: new Set([face]), sources: [String(s.id)] });
          after = at;
        }
      }
    }
    // Main first, then the other paths by name, each in merged order.
    const paths = [...new Set(merged.map((m) => m.path))].sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));
    let number = 0;
    for (const path of paths) {
      let position = 0;
      for (const m of merged.filter((x) => x.path === path)) {
        const id = `${flowId}-S${two(++number)}`;
        for (const source of m.sources) renamed.set(source, id);
        const row: Raw = { id, title: m.title, flow_id: flowId, path, position: ++position };
        if (interfaces.length > 1 && m.through.size === 1) {
          row.interface_id = [...m.through][0];
          variants.set(id, String(row.interface_id));
        } else if (m.through.size < interfaces.length) {
          partial.push(`${id} (through ${[...m.through].sort().join(', ')})`);
        }
        newSteps.push(row);
        for (const source of m.sources) if (happensIn.has(source) && !invokes.has(source)) viewless.push(`${id} happened in ${happensIn.get(source)}`);
      }
    }

    // One acceptance test stays.
    const ownTests = tests.filter((t) => own.some((f) => f.id === t.flow_id));
    const interfaceOf = new Map(own.map((f) => [String(f.id), String(f.interface_id)]));
    ownTests.sort((a, b) => rank(STATES, a.state) - rank(STATES, b.state) || rank(LEVELS, a.level) - rank(LEVELS, b.level) || interfaceOf.get(String(a.flow_id))!.localeCompare(interfaceOf.get(String(b.flow_id))!));
    const kept = ownTests[0];
    for (const t of ownTests) renamed.set(String(t.id), `${flowId}-T`);
    if (kept) {
      keptTests.add(String(kept.id));
      newTests.push({ ...kept, id: `${flowId}-T`, flow_id: flowId });
    }
    for (const t of ownTests.slice(1)) dropped.push(`${String(t.id)} (${interfaceOf.get(String(t.flow_id))}${t.file ? `, ${String(t.file)}` : ''})`);
  }

  // The views each step happened in now present what it invoked.
  const presents = new Map<string, Raw>();
  for (const [step, view] of happensIn) {
    const operation = invokes.get(step);
    if (operation) presents.set(`${view} ${operation}`, { source_id: view, target_id: operation });
  }
  // Every mention of an old ID, in any table, takes the new one.
  const mention = renamed.size ? new RegExp(`(?<![A-Za-z0-9-])(${[...renamed.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![A-Za-z0-9-])`, 'g') : null;
  const rename = (value: unknown): unknown =>
    typeof value === 'string' && mention ? value.replace(mention, (old) => renamed.get(old)!) : Array.isArray(value) ? value.map(rename) : value;
  const renameRow = (row: Raw): Raw => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, rename(value)]));
  const unique = (rows: Raw[]) => [...new Map(rows.map((r) => [JSON.stringify(r), r])).values()];
  const OWN = new Set(['flow', 'flow_step', 'flow_test', 'happens_in', 'invokes', 'fulfills', 'exchanges_with', 'offers', 'presents']);
  for (const table of data.tables()) {
    if (OWN.has(table)) continue;
    let rows = data.read(table);
    // A dropped test's data sets go with it.
    if (table === 'starts_from') rows = rows.filter((r) => !tests.some((t) => t.id === r.source_id) || keptTests.has(String(r.source_id)));
    const after = unique(rows.map(renameRow));
    if (JSON.stringify(after) !== JSON.stringify(data.read(table))) data.write(table, after);
  }
  const stepLinks = (table: string) => unique(data.read(table).map(renameRow));
  data.write('flow', newFlows);
  data.write('flow_step', newSteps.map(renameRow));
  data.write('flow_test', newTests.map(renameRow));
  data.write('fulfills', stepLinks('fulfills'));
  data.write('invokes', stepLinks('invokes'));
  data.write('exchanges_with', stepLinks('exchanges_with'));
  data.write('happens_in', []);
  data.write('offers', unique([...data.read('offers'), ...offers]));
  data.write('presents', unique([...data.read('presents'), ...presents.values()]));

  notes.changed(`Each use case has one flow, the same whatever the interface: ${flows.length} flows merged into ${newFlows.length}, with ${newSteps.length} steps (${variants.size} variants of one interface), each interface offering the use cases it had a flow of (${offers.length} offers), and each view presenting what its steps invoked (${presents.size} presents).`);
  if (dropped.length) {
    notes.todo(
      `A use case keeps one acceptance test; each interface's way of carrying out a step is proved once per rule and domain by its pattern's rule tests. Have each interface follow its pattern, prove its rules in each domain, and rename or remove the test cases that named these tests, now gone: ${dropped.join(', ')}.`,
    );
  }
  if (variants.size) notes.todo(`A step only one interface's flow had is now a variant of that interface; make each a step of every interface where they all do it: ${[...variants].map(([id, face]) => `${id} (${face})`).join(', ')}.`);
  if (partial.length) notes.todo(`A step some but not all interfaces' flows had is now every interface's; make sure each does it: ${partial.join(', ')}.`);
  if (viewless.length) notes.todo(`A step no longer happens in a view, and these invoked nothing a view could present: have each invoke the query its view answers, or remove it: ${viewless.join(', ')}.`);
  notes.todo('List the roles that use each interface (interface_actor), mark each view only one interface shows with its interface, and rename the flow, step and flow test IDs your code names.');
}

const converter: Converter = {
  files(data, notes) {
    const kinds = data.read('product_kind');
    const given = kinds.filter((k) => k.complexity === undefined);
    if (given.length) {
      data.write(
        'product_kind',
        kinds.map((k) => (k.complexity === undefined ? { ...k, complexity: COMPLEXITY_BY_STAGE[String(k.stage)] ?? 'essential' } : k)),
      );
      notes.changed(`Each product kind says its complexity, given from its stage: ${given.map((k) => `${String(k.name)} ${COMPLEXITY_BY_STAGE[String(k.stage)] ?? 'essential'}`).join(', ')}.`);
    }

    const automatic = accountingPairs(data.read('product_kind'));
    const relations = data.read('product_relation');
    const dropped = relations.filter((r) => automatic.has(`${String(r.name)} ${String(r.source_kind)} ${String(r.target_kind)}`));
    if (dropped.length) {
      data.write('product_relation', relations.filter((r) => !dropped.includes(r)));
      notes.changed(
        `Each product kind has Lathe's pairs of provided_by, fills and generates as Lathe's own kinds have them, so the declarations of ${dropped.map((r) => `${String(r.name)} from ${String(r.source_kind)} to ${String(r.target_kind)}`).join(', ')} were dropped.`,
      );
    }

    const standards = data.read('standard');
    const typed = standards.filter((s) => s.type === undefined);
    if (typed.length) {
      data.write('standard', standards.map((s) => (s.type === undefined ? { ...s, type: 'engineering' } : s)));
      notes.changed(`Each standard has a type: ${typed.length} made engineering, as every standard was under schema 3.`);
      notes.todo(
        `A standard whose rules say what the product's people need, whatever it is built with (exact money, auditability, a latency budget), is a quality: change its type to quality where it is one, among ${typed.map((s) => String(s.id)).join(', ')}.`,
      );
    }

    const settings = data.read('product_setting');
    const worded = settings.filter((s) => s.technology_words === undefined);
    if (worded.length) {
      data.write('product_setting', settings.map((s) => (s.technology_words === undefined ? { ...s, technology_words: [] } : s)));
      notes.changed(`Each product setting lists the words its checks read as technology: none at first, for ${worded.map((s) => String(s.product_id)).join(', ')}.`);
    }

    const interfaces = data.read('interface');
    const unmarked = interfaces.filter((i) => i.public === undefined);
    if (unmarked.length) {
      data.write('interface', interfaces.map((i) => (i.public === undefined ? { ...i, public: false } : i)));
      notes.changed(`Each interface says whether it is public: ${unmarked.length} made internal.`);
      notes.todo(
        `An interface that people or programs outside the product build on is public, and its API requirements are then essential: change public to true where it is one, among ${unmarked.map((i) => String(i.id)).join(', ')}.`,
      );
    }

    neutralFlows(data, notes);
  },
};

export default converter;
