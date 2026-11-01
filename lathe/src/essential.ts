// What keeps accidental complexity out of essential records, written once: which records are essential (a record's
// complexity, by its kind, the record above it, its type or its product's interfaces), which word group each kind's
// records are read in, and the words each group has no business with. The store's views (essential_word_group and
// essential_word, platform/data/integrity.ts) give the same groups and words to the checks' SQL, so the check that
// warns of a record already in the data (accidental-in-essential) and the refusal of a write (write-rules.ts) read
// one list. The review of the essential records (checking/essential-review) reads the same records.
import { domainOf, placeIn, productOf } from './authoring/extension-record/declaration.ts';
import type { ReadView } from './platform/data/rules.ts';
import type { KindDescription } from './platform/data/schema.ts';

/**
 * The group a kind's records are read in: the domain model, use cases, flows and every other essential kind (model);
 * a view and its requirements, on their interface by nature (view); an interface, an integration and an API
 * requirement, a contract with the outside world that names its mechanism (surface).
 */
export type WordGroup = 'model' | 'view' | 'surface';

/** The technical kinds, which no essential record names. */
const TECHNICAL_KIND_WORDS = [
  'data store', 'repository', 'data model', 'value type', 'event type', 'projection', 'command handler', 'query handler',
  'event handler', 'endpoint handler', 'adapter', 'entry point', 'ui component',
];

/** The mechanisms of an interface and of storage that even a view has no business with. */
const MECHANISM_WORDS = ['endpoint', 'http', 'query string', 'json', 'sql', 'database'];

/** The places and gestures of an interface, and the shape of storage, which are a view's but no other essential record's. */
const PLACE_WORDS = ['page', 'screen', 'button', 'click', 'route', 'url', 'table', 'row', 'column'];

/** Lathe's own words, by the group that has no business with them. */
export const ESSENTIAL_WORDS: readonly { group: WordGroup; word: string }[] = [
  ...(['model', 'view', 'surface'] as const).flatMap((group) => TECHNICAL_KIND_WORDS.map((word) => ({ group, word }))),
  ...(['model', 'view'] as const).flatMap((group) => MECHANISM_WORDS.map((word) => ({ group, word }))),
  ...PLACE_WORDS.map((word) => ({ group: 'model' as const, word })),
];

/**
 * The group a kind's records are read in, or null for a kind none is: a pattern, its rules and slots, where the
 * product decides its accidental complexity once; a test, which says how it proves through the interface it drives;
 * and a kind that is never essential.
 */
export function wordGroupOf(kind: KindDescription): WordGroup | null {
  if (kind.complexity === null || kind.complexity === 'accidental') return null;
  if (['pattern', 'pattern_rule', 'slot'].includes(kind.name)) return null;
  if (kind.stage === 'test-plan' && kind.complexity === 'as-parent') return null;
  if (kind.name === 'view' || kind.name === 'view_requirement') return 'view';
  if (['interface', 'integration', 'api_requirement'].includes(kind.name)) return 'surface';
  return 'model';
}

/**
 * The first of the words the text names, as the check reads it: in any letter case, as a whole word, singular or
 * plural (repository and repositories alike); undefined when it names none.
 */
export function wordNamed(text: string, words: readonly string[]): string | undefined {
  const alternatives = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((w) => (w === 'repository' ? 'repositor(?:y|ies)' : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (!alternatives.length) return undefined;
  const found = new RegExp(`(^|[^a-z0-9])(${alternatives.join('|')})(e?s)?([^a-z0-9]|$)`).exec(text.toLowerCase());
  return found ? found[2] : undefined;
}

/** Where records sit, read once from the data: each record's product, domain and complexity. */
export interface Placement {
  productOf(id: string): string | null;
  domainOf(id: string): string | undefined;
  /** Whether the record is essential or accidental complexity; null for an open question or a record that is neither. */
  complexityOf(id: string): 'essential' | 'accidental' | null;
}

/**
 * The placement of the data's records. A record's domain is the one it sits under, or for a kind whose IDs start with
 * their domain's (a specification) the longest domain ID its own starts with; a record of a kind with no owner (a
 * view, a value object) is in none. Its complexity is its kind's, or for an as-parent kind (a test, a standard rule)
 * the nearest record above it that is not, for a standard its type's (quality is essential) and for an API
 * requirement its product's interfaces' (essential when the product has a public API).
 */
export function placementOf(view: ReadView): Placement {
  const place = placeIn(view);
  const products = view.rows('product').map((p) => String(p.id));
  const domains = view.rows('domain').map((d) => String(d.id));
  const publicApi = new Set(view.rows('interface').filter((i) => i.public === true && i.kind === 'API').map((i) => String(i.product_id)));
  const product = (id: string) => productOf(place, products, id);
  const complexityOf = (id: string): 'essential' | 'accidental' | null => {
    const seen = new Set<string>();
    for (let at = view.record(id), atId = id; at && !seen.has(atId); ) {
      seen.add(atId);
      const kind = view.schema.kinds[at.kind];
      switch (kind?.complexity) {
        case 'essential':
        case 'accidental':
          return kind.complexity;
        case 'by-type':
          return at.row.type === 'quality' ? 'essential' : 'accidental';
        case 'by-interface': {
          const owner = product(atId);
          return owner !== null && publicApi.has(owner) ? 'essential' : 'accidental';
        }
        case 'as-parent': {
          const up = place(atId)?.parent;
          if (up === undefined) return null;
          atId = up;
          at = view.record(up);
          break;
        }
        default:
          return null;
      }
    }
    return null;
  };
  return {
    productOf: product,
    domainOf: (id) => {
      const up = domainOf(place, id);
      if (up) return up;
      const at = view.record(id);
      if (!at || view.schema.kinds[at.kind]?.idScope !== 'domain') return undefined;
      return domains.filter((d) => id.startsWith(`${d}-`)).sort((a, b) => b.length - a.length)[0];
    },
    complexityOf,
  };
}
