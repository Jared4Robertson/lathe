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
import type { Converter } from '../src/upgrade.ts';

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
  },
};

export default converter;
