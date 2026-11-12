// Schema 7 to 8: each use case names its result, the one command its actor invokes or the one query they ask, which
// makes it a command use case or a query use case. Each use case gains `result_id`, read from its flow's main path
// (its steps of every interface): a main path that invokes one command takes it; one that invokes no command takes the
// query of its last step that invokes anything; one that invokes several commands takes the command of its last step
// that invokes one, and is a to-do to split. A use case whose main path invokes nothing gets no result: it is a to-do,
// and the data does not load until it has one, so the upgrade stops. Two use cases of a product with the same first
// actor and result are a to-do to merge. What the converter cannot see (a command on another path, a use case not done
// at its result) is left to `lathe check`.
import type { Converter } from '../src/upgrade.ts';

/** IDs in ID order: the numbers inside them compared by value (UC2 before UC10), as Lathe sorts them everywhere. */
const collator = new Intl.Collator('en', { numeric: true });

const converter: Converter = {
  files(data, notes) {
    const useCases = data.read('use_case');
    const open = useCases.filter((u) => u.result_id === undefined);
    if (open.length === 0) return;

    const commands = new Set(data.read('command').map((c) => String(c.id)));
    const invokes = new Map(data.read('invokes').map((l) => [String(l.source_id), String(l.target_id)]));
    const flowOf = new Map(data.read('flow').map((f) => [String(f.use_case_id), String(f.id)]));
    // Each flow's main-path steps that invoke something, in order: every interface's variants with the common steps.
    const invoking = new Map<string, { position: number; operation: string }[]>();
    for (const s of data.read('flow_step')) {
      const operation = invokes.get(String(s.id));
      if (String(s.path).trim() !== 'main' || operation === undefined) continue;
      const flow = String(s.flow_id);
      invoking.set(flow, [...(invoking.get(flow) ?? []), { position: Number(s.position), operation }]);
    }

    const results = new Map<string, string>();
    let byCommand = 0;
    let byQuery = 0;
    let byLastCommand = 0;
    for (const u of [...open].sort((a, b) => collator.compare(String(a.id), String(b.id)))) {
      const id = String(u.id);
      const steps = [...(invoking.get(flowOf.get(id) ?? '') ?? [])].sort((a, b) => a.position - b.position);
      const commandSteps = steps.filter((s) => commands.has(s.operation));
      const distinct = new Set(commandSteps.map((s) => s.operation));
      if (steps.length === 0) {
        notes.todo(`${id} has no result: its flow's main path invokes nothing. Give it a step that invokes the command or query it exists for, or make it a rule, then run the upgrade again.`);
        continue;
      }
      if (distinct.size === 0) {
        results.set(id, steps.at(-1)!.operation);
        byQuery++;
        continue;
      }
      results.set(id, commandSteps.at(-1)!.operation);
      if (distinct.size === 1) {
        byCommand++;
        continue;
      }
      byLastCommand++;
      notes.todo(`split ${id}: its main path invokes ${distinct.size} commands (${[...distinct].sort(collator.compare).join(', ')}); its result is the last, ${commandSteps.at(-1)!.operation}, and each other is a use case of its own or a policy.`);
    }

    // The column sits after goal, as the table has it.
    data.write(
      'use_case',
      useCases.map((u) => {
        const result = results.get(String(u.id));
        if (result === undefined) return u;
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(u)) {
          row[key] = value;
          if (key === 'goal') row.result_id = result;
        }
        if (!('result_id' in row)) row.result_id = result;
        return row;
      }),
    );
    notes.changed(`Each use case names its result: ${results.size} of ${open.length} set from their flows, ${byCommand} its one command, ${byQuery} a query and ${byLastCommand} the last of several commands.`);

    // Identity is the first actor and the result, within a product.
    const productOf = new Map<string, string>();
    const domainOf = new Map(data.read('capability').map((c) => [String(c.id), String(c.domain_id)]));
    const productOfDomain = new Map(data.read('domain').map((d) => [String(d.id), String(d.product_id)]));
    for (const u of useCases) productOf.set(String(u.id), productOfDomain.get(domainOf.get(String(u.capability_id)) ?? '') ?? '');
    const firstActor = new Map(data.read('use_case_actor').filter((a) => Number(a.position) === 1).map((a) => [String(a.use_case_id), String(a.role_name)]));
    const resultOf = (u: Record<string, unknown>) => (u.result_id === undefined ? results.get(String(u.id)) : String(u.result_id));
    const first = new Map<string, string>();
    for (const u of [...useCases].sort((a, b) => collator.compare(String(a.id), String(b.id)))) {
      const id = String(u.id);
      const result = resultOf(u);
      const actor = firstActor.get(id);
      if (result === undefined || actor === undefined) continue;
      const identity = `${productOf.get(id)} ${actor} ${result}`;
      const earlier = first.get(identity);
      if (earlier === undefined) first.set(identity, id);
      else notes.todo(`merge ${id} into ${earlier}: both are the ${actor}'s, with the result ${result}.`);
    }
    notes.changed('`lathe check` lists the rest: a command besides the result on another path, and a use case not done at its result.');
  },
};

export default converter;
