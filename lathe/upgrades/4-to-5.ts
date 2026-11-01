// Schema 4 to 5: journeys. A journey is the use cases and handoffs, in order, that take a product's people from a
// trigger to a result a business outcome measures; it lives in Discovery beside the outcomes, with its steps
// (journey_step, each carrying out a use case or a policy: carries_out) and its one journey test (journey_test), and it
// serves outcomes as a capability does (serves, now from a capability or a journey). The change only adds, so no row
// changes. What this converter does is ask: a product's own kind or relation with a name schema 5 now takes must be
// renamed, since it would clash with Lathe's new table; an outcome whose measure times something from one moment to
// another times a journey, which the product writes; and every product is told where journeys go.
import type { Converter } from '../src/upgrade.ts';

/** The tables schema 5 adds: a product's own kind or relation of one of these names clashes with Lathe's. */
const NEW_TABLES = ['journey', 'journey_step', 'journey_test', 'carries_out', 'serves_source', 'carries_out_target'];

/** A measure that reads as a duration: the time from one moment to another, which a journey runs between. */
const DURATION = /\b(time|days|hours|minutes|weeks) from\b|\bhow long\b|\bmedian\b.*\bfrom\b|\bfrom\b.+\bto\b/i;

const converter: Converter = {
  files(data, notes) {
    const clashes = [
      ...data.read('product_kind').filter((k) => NEW_TABLES.includes(String(k.name))).map((k) => `the kind ${String(k.name)}`),
      ...[...new Set(data.read('product_relation').map((r) => String(r.name)).filter((name) => NEW_TABLES.includes(name)))].map((name) => `the relation ${name}`),
    ];
    if (clashes.length) {
      notes.todo(
        `Schema 5 adds Lathe's own ${NEW_TABLES.join(', ')}; rename your own ${clashes.join(', ')} (its declaration, its data file and every mention), then run \`npx lathe upgrade\` again.`,
      );
    }

    const timed = data.read('business_outcome').filter((o) => DURATION.test(String(o.measure ?? '')));
    if (timed.length) {
      notes.todo(
        `An outcome whose measure is a duration times a journey: write the journey each of these measures times, its trigger and result first, then its steps, and link it to the outcome (serves): ${timed.map((o) => String(o.id)).join(', ')}.`,
      );
    }

    if (!clashes.length && data.read('journey').length === 0) {
      notes.todo(
        'Journeys arrive in Discovery: write the journeys that reach your outcomes with `lathe journey add-journey`, each step carrying out a use case or a policy, and its journey test.',
      );
    }
  },
};

export default converter;
