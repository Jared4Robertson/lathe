// Schema 8 to 9: a use case sits with its result. Its group is its result's aggregate (a command use case: the
// command's entity's aggregate) or read model (a query use case), worked out and never stored, and its parent is its
// domain. The capability kind goes: each use case's `capability_id` becomes `domain_id`, its capability's domain; each
// capability's `serves` rows become one row for each distinct group of its use cases, so an aggregate or read model
// serves an outcome only when a use case of it served that outcome through its capability; and `capability.jsonl` goes.
// What only a person can settle is a to-do: a capability with no use case (its outcomes), an `about` link to a
// capability (dropped), a product check whose query names `capability`, records whose text names a capability ID, and
// each use case whose result is in another domain (lathe check reports it as use-case-result-in-domain). A product kind
// or relation built on capabilities stops the upgrade, since the store would refuse it.
import type { Converter } from '../src/upgrade.ts';

/** IDs in ID order: the numbers inside them compared by value (UC2 before UC10), as Lathe sorts them everywhere. */
const collator = new Intl.Collator('en', { numeric: true });
const byId = (a: string, b: string) => collator.compare(a, b);

const converter: Converter = {
  files(data, notes) {
    const capabilities = data.read('capability');
    const useCases = data.read('use_case');
    if (capabilities.length === 0 && !useCases.some((u) => 'capability_id' in u)) return;

    // A product's own kinds and relations built on capabilities: the store would refuse them, so the upgrade stops.
    const kinds = data.read('product_kind').filter((k) => k.parent_kind === 'capability').map((k) => String(k.name));
    const relations = data.read('product_relation').filter((r) => r.source_kind === 'capability' || r.target_kind === 'capability').map((r) => String(r.name));
    if (kinds.length || relations.length) {
      const named = [...kinds.map((k) => `kind ${k} (and its records)`), ...relations.map((r) => `relation ${r}`)].join(', ');
      notes.todo(`Schema 9 has no capability kind. Your own ${named} names it: put it under a domain, an aggregate or a read model instead, then run \`npx lathe upgrade\` again.`);
      return;
    }

    // Each use case's group, from its result.
    const aggregateOfEntity = new Map(data.read('entity').map((e) => [String(e.id), String(e.aggregate_id)]));
    const aggregateOfCommand = new Map(data.read('command').map((c) => [String(c.id), aggregateOfEntity.get(String(c.entity_id))]));
    const readModelOfQuery = new Map(data.read('query').map((q) => [String(q.id), String(q.read_model_id)]));
    const domainOfGroup = new Map([...data.read('aggregate'), ...data.read('read_model')].map((r) => [String(r.id), String(r.domain_id)]));
    const groupOf = (u: Record<string, unknown>) => {
      const result = String(u.result_id);
      return aggregateOfCommand.get(result) ?? readModelOfQuery.get(result);
    };

    // use_case: capability_id becomes domain_id, its capability's domain, in the same column place.
    const domainOfCapability = new Map(capabilities.map((c) => [String(c.id), String(c.domain_id)]));
    data.write(
      'use_case',
      useCases.map((u) => {
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(u)) {
          if (key === 'capability_id') row.domain_id = domainOfCapability.get(String(value)) ?? value;
          else row[key] = value;
        }
        return row;
      }),
    );
    notes.changed(`Each use case's parent is its domain: ${useCases.length} use cases take their capability's domain.`);

    // serves: each capability's outcomes go to the groups of its use cases.
    const groupsOfCapability = new Map<string, Set<string>>();
    for (const u of useCases) {
      const group = groupOf(u);
      if (group === undefined) continue;
      const capability = String(u.capability_id);
      groupsOfCapability.set(capability, (groupsOfCapability.get(capability) ?? new Set()).add(group));
    }
    const serves = data.read('serves');
    const kept: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    const add = (source: string, target: string) => {
      const key = `${source} ${target}`;
      if (seen.has(key)) return;
      seen.add(key);
      kept.push({ source_id: source, target_id: target });
    };
    const lonely = new Map<string, string[]>();
    let fromCapabilities = 0;
    for (const row of serves) {
      const source = String(row.source_id);
      const target = String(row.target_id);
      if (!domainOfCapability.has(source)) {
        add(source, target);
        continue;
      }
      fromCapabilities++;
      const groups = groupsOfCapability.get(source);
      if (!groups?.size) lonely.set(source, [...(lonely.get(source) ?? []), target]);
      else for (const group of [...groups].sort(byId)) add(group, target);
    }
    data.write('serves', kept.sort((a, b) => byId(String(a.source_id), String(b.source_id)) || byId(String(a.target_id), String(b.target_id))));
    const journeyRows = serves.length - fromCapabilities;
    notes.changed(`Aggregates and read models serve the outcomes their use cases' capabilities served: serves ${serves.length} → ${kept.length} rows (${fromCapabilities} from capabilities became ${kept.length - journeyRows}; ${journeyRows} from journeys kept).`);
    for (const [capability, outcomes] of [...lonely].sort(([a], [b]) => byId(a, b))) {
      notes.todo(`${capability} had no use case and served ${outcomes.sort(byId).join(', ')}: name the aggregate or read model that serves each (serves on Add or Change an aggregate or read model).`);
    }

    // The capabilities go.
    data.write('capability', []);
    notes.changed(`The capability kind is gone: ${capabilities.length} capabilities removed.`);

    // Links and records that name a capability.
    const capabilityIds = new Set(domainOfCapability.keys());
    const about = data.read('about');
    const aboutCapability = about.filter((l) => capabilityIds.has(String(l.target_id)) || capabilityIds.has(String(l.source_id)));
    if (aboutCapability.length) {
      data.write('about', about.filter((l) => !aboutCapability.includes(l)));
      notes.todo(`${aboutCapability.length} about link${aboutCapability.length === 1 ? '' : 's'} to a capability went: ${aboutCapability.map((l) => `${String(l.source_id)} → ${String(l.target_id)}`).join(', ')}. Point each question at the aggregate or read model it is about.`);
    }
    for (const c of data.read('check')) {
      if (/\bcapability\b/.test(String(c.query ?? ''))) notes.todo(`Your check ${String(c.name)} reads the capability table, which is gone: read the use cases' aggregates and read models instead.`);
    }
    const mention = new RegExp(`\\b(${[...capabilityIds].map((id) => id.replace(/[-]/g, '\\-')).join('|')})\\b`);
    let mentioning = 0;
    if (capabilityIds.size) {
      for (const table of data.tables()) {
        if (table === 'serves' || table === 'use_case' || table === 'about') continue;
        for (const row of data.read(table)) if (mention.test(JSON.stringify(row))) mentioning++;
      }
    }
    if (mentioning) notes.todo(`${mentioning === 1 ? '1 record names' : `${mentioning} records name`} a capability ID in its text: reword each to name the aggregate or read model instead.`);

    // A use case sits in its result's domain.
    for (const u of [...useCases].sort((a, b) => byId(String(a.id), String(b.id)))) {
      const group = groupOf(u);
      const domain = domainOfCapability.get(String(u.capability_id));
      const resultDomain = group === undefined ? undefined : domainOfGroup.get(group);
      if (resultDomain === undefined || resultDomain === domain) continue;
      notes.todo(`move ${String(u.id)} to ${resultDomain}: its result ${String(u.result_id)} is of that domain (Move a use case).`);
    }
  },
};

export default converter;
