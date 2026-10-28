// Schema 1 to 2: one flow per interface. A product now declares its interfaces (web app, API, CLI, agent tools,
// desktop or other), and each flow names the one it goes through, with its ID ending in that interface's number
// (TL-LEND-UC01-FL becomes TL-LEND-UC01-FL01, its steps TL-LEND-UC01-FL01-S01 and its test TL-LEND-UC01-FL01-T).
//
// The files phase gives every product with flows one interface, <P>-IF01, of kind other, and puts every flow through
// it, renaming each flow, step and flow test, and every mention of their IDs in any table, links and text alike. Which
// interface each flow really walks only the Owner knows: that, and the IDs in code (a test's file names its test's
// ID), are the to-dos.
import type { Converter, RawData } from '../src/upgrade.ts';

type Raw = Record<string, unknown>;

/** The product of each use case, through its capability and domain. */
function useCaseProducts(data: RawData): Map<string, string> {
  const domains = new Map(data.read('domain').map((d) => [String(d.id), String(d.product_id)]));
  const capabilities = new Map(data.read('capability').map((c) => [String(c.id), domains.get(String(c.domain_id))]));
  return new Map(data.read('use_case').flatMap((u) => {
    const product = capabilities.get(String(u.capability_id));
    return product ? [[String(u.id), product] as const] : [];
  }));
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const converter: Converter = {
  files(data, notes) {
    const flows = data.read('flow');
    if (flows.length === 0) return;
    const products = useCaseProducts(data);
    const useCases = [...new Set(flows.map((f) => String(f.use_case_id)))].sort((a, b) => b.length - a.length);
    // A whole use case ID followed by -FL and no more letters or digits: the flow's own ID, or the start of a step's
    // or its test's (TL-LEND-UC01-FL-S01).
    const mention = new RegExp(`(?<![A-Za-z0-9-])(${useCases.map(escape).join('|')})-FL(?![A-Za-z0-9])`, 'g');
    const rename = (value: unknown): unknown =>
      typeof value === 'string' ? value.replace(mention, '$1-FL01') : Array.isArray(value) ? value.map(rename) : value;

    const interfaces = [...new Set(flows.flatMap((f) => products.get(String(f.use_case_id)) ?? []))].sort();
    for (const table of data.tables()) {
      if (table === 'flow') continue;
      const rows = data.read(table);
      const renamed = rows.map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, rename(value)])));
      if (JSON.stringify(renamed) !== JSON.stringify(rows)) data.write(table, renamed);
    }
    data.write('flow', flows.map((flow): Raw => {
      const renamed = Object.fromEntries(Object.entries(flow).map(([column, value]) => [column, rename(value)]));
      const product = products.get(String(flow.use_case_id));
      return product ? { ...renamed, interface_id: `${product}-IF01` } : renamed;
    }));
    data.write('interface', [
      ...data.read('interface'),
      ...interfaces.map((product) => ({
        id: `${product}-IF01`,
        title: 'Interface',
        product_id: product,
        kind: 'other',
        description: 'Every flow written before interfaces were declared goes through this one.',
      })),
    ]);
    notes.changed(`Every flow goes through its product's new interface (${interfaces.map((p) => `${p}-IF01`).join(', ')}), and its ID, its steps' and its test's end in FL01: ${flows.length} flows renamed.`);
    for (const product of interfaces) {
      notes.todo(`${product}-IF01 stands for every interface ${product}'s flows went through: give it the title and kind of the one most of them walk (web app, API, CLI, agent tools, desktop), declare the others, and give each flow that walks another interface that interface, with its ID ending in that interface's number.`);
    }
    notes.todo('Rename the flow, step and flow test IDs your code names, such as a test file naming its flow test: <use case>-FL-T is now <use case>-FL01-T.');
  },
};

export default converter;
