import type { Coverage, Kind, RelationRule, SpecLink, SpecRecord, Workspace } from '../../../lathe/src/types';
import sample from '../../../lathe/fixtures/workspace.sample.json';

// A small workspace for the component tests. Two products:
// - DM (Demo): two domains, two fitness records, questions and problems. DM-SHOP's coverage has
//   built counts; DM-PAY's has none, as the engine reported before it measured built coverage.
// - NF (No fitness): one domain and no fitness record.

const kinds: Kind[] = (sample as unknown as Workspace).kinds.some((k) => k.kind === 'fitness')
  ? (sample as unknown as Workspace).kinds
  : [
      ...(sample as unknown as Workspace).kinds,
      { kind: 'fitness', label: 'Fitness', stage: '', parent_kinds: ['product'], required_fields: ['date', 'score'], obligation: false, proof_only: false, description: 'How well the product serves its purpose.' },
    ];
const relations: RelationRule[] = (sample as unknown as Workspace).relations;

function record(id: string, kind: string, title: string, parent: string | null, fields: Record<string, string> = {}, body = ''): SpecRecord {
  const parts = id.split('-');
  const product = parts[0];
  const domain = kind === 'product' || kind === 'fitness' || (kind === 'question' && parts.length === 2) ? null : parts.slice(0, 2).join('-');
  return { id, kind, title, parent, product, domain, fields, body, path: `specs/${product.toLowerCase()}/${id}.md`, mentions: [] };
}

export const records: SpecRecord[] = [
  record('DM', 'product', 'Demo shop', null, {}, 'A demo product for the **component tests**.'),
  record('DM-FIT01', 'fitness', 'Early days', 'DM', { date: '2026-09-01', score: '2' }, 'It was hard to find anything.'),
  record('DM-FIT02', 'fitness', 'Finding things is quick', 'DM', { date: '2026-10-20', score: '4' }, 'I traced a requirement to its tests in *two clicks*.'),
  record('DM-Q01', 'question', 'Should the shop ship abroad?', 'DM', { owner: 'the Owner' }, 'Undecided.'),

  record('DM-SHOP', 'domain', 'Shopping', 'DM', {}, 'People pick goods and pay.'),
  record('DM-SHOP-A1', 'aggregate', 'Basket', 'DM-SHOP', {}, 'The goods a person means to buy.'),
  record('DM-SHOP-DR01', 'domain_rule', 'A basket holds at most 50 items', 'DM-SHOP-A1', {}, 'A basket MUST NOT hold more than 50 items.'),
  record('DM-SHOP-UC01', 'use_case', 'Add an item to the basket', 'DM-SHOP', { actor: 'Shopper' }, 'A shopper adds an item.'),
  record('DM-SHOP-UC01-R01', 'requirement', 'The basket shows the new item', 'DM-SHOP-UC01', {}, 'The basket MUST show the item at once.'),
  record('DM-SHOP-UC01-R02', 'requirement', 'A full basket refuses the item', 'DM-SHOP-UC01', {}, 'A full basket MUST refuse a new item.'),
  record('DM-SHOP-F01', 'flow', 'Fill a basket', 'DM-SHOP'),
  record('DM-SHOP-V01', 'view', 'Basket page', 'DM-SHOP', { route: '/basket' }),
  record('DM-SHOP-E01', 'endpoint', 'Add to basket', 'DM-SHOP', { method: 'POST', route: '/basket/items' }),
  record('DM-SHOP-C01', 'component', 'Basket service', 'DM-SHOP', { component_type: 'service', file: 'src/basket.ts' },
    'Holds baskets.\n\n<script>window.__pwned = true</script><img src="x" onerror="window.__pwned = true"><a href="javascript:alert(1)">bad link</a>'),
  record('DM-SHOP-T01', 'test', 'Adding an item shows it', 'DM-SHOP', { test_type: 'unit', run_by: 'test/basket.test.ts' }),
  record('DM-SHOP-Q01', 'question', 'What happens to a basket overnight?', 'DM-SHOP', { owner: 'Ana' }),

  record('DM-PAY', 'domain', 'Paying', 'DM', {}, 'People pay for a basket.'),
  record('DM-PAY-UC01', 'use_case', 'Pay by card', 'DM-PAY', { actor: 'Shopper' }),
  record('DM-PAY-UC01-R01', 'requirement', 'A declined card leaves the basket unpaid', 'DM-PAY-UC01'),

  record('NF', 'product', 'Notebook', null, {}, 'A product with no fitness record.'),
  record('NF-NOTE', 'domain', 'Notes', 'NF', {}, 'People write notes.'),
];

export const links: SpecLink[] = [
  { source: 'DM-SHOP-UC01', relation: 'applies', target: 'DM-SHOP-DR01' },
  { source: 'DM-SHOP-F01', relation: 'uses', target: 'DM-SHOP-V01' },
  { source: 'DM-SHOP-F01', relation: 'fulfills', target: 'DM-SHOP-UC01-R01' },
  { source: 'DM-SHOP-V01', relation: 'fulfills', target: 'DM-SHOP-UC01-R01' },
  { source: 'DM-SHOP-E01', relation: 'fulfills', target: 'DM-SHOP-UC01-R01' },
  { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-UC01-R01' },
  { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-UC01-R02' },
  { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-DR01' },
  { source: 'DM-SHOP-C01', relation: 'implements', target: 'DM-SHOP-E01' },
  { source: 'DM-SHOP-T01', relation: 'proves', target: 'DM-SHOP-UC01-R01' },
  { source: 'DM-Q01', relation: 'about', target: 'DM' },
  { source: 'DM-SHOP-Q01', relation: 'about', target: 'DM-SHOP-A1' },
];

// No tests counts in these: as an older engine reports coverage (shown as not yet measured).
const shopCoverage = {
  domain: 'DM-SHOP',
  requirements: 2, requirements_satisfied: 2, requirements_built: 1, requirements_proved: 1,
  rules: 1, rules_satisfied: 1, rules_built: 1, rules_proved: 0,
  gaps: [
    { id: 'DM-SHOP-UC01-R02', kind: 'requirement', missing: 'proves' },
    { id: 'DM-SHOP-DR01', kind: 'domain_rule', missing: 'proves' },
  ],
  // Empty on purpose: the pages fall back to the requirement and rule fields above.
  obligations: [],
} as unknown as Coverage;

// Built counts left out on purpose: they must show as "not yet measured", never as zero.
const payCoverage = {
  domain: 'DM-PAY',
  requirements: 1, requirements_satisfied: 0, requirements_proved: 0,
  rules: 0, rules_satisfied: 0, rules_proved: 0,
  gaps: [
    { id: 'DM-PAY-UC01-R01', kind: 'requirement', missing: 'satisfies' },
    { id: 'DM-PAY-UC01-R01', kind: 'requirement', missing: 'proves' },
  ],
} as unknown as Coverage;

const noteCoverage = {
  domain: 'NF-NOTE',
  requirements: 0, requirements_satisfied: 0, requirements_built: 0, requirements_proved: 0,
  rules: 0, rules_satisfied: 0, rules_built: 0, rules_proved: 0,
  gaps: [],
  obligations: [],
} as unknown as Coverage;

export function workspace(): Workspace {
  return {
    kinds,
    relations,
    records: structuredClone(records),
    links: structuredClone(links),
    problems: [
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-DR01', message: 'No test proves domain rule DM-SHOP-DR01.' },
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-UC01-R02', message: 'No test proves requirement DM-SHOP-UC01-R02.' },
      { severity: 'error', check: 'test-file-missing', record: 'DM-SHOP-T01', message: 'Test DM-SHOP-T01 is run by test/basket.test.ts, which does not exist.' },
      { severity: 'warning', check: 'unsatisfied', record: 'DM-PAY-UC01-R01', message: 'No component satisfies requirement DM-PAY-UC01-R01.' },
      { severity: 'error', check: 'dangling-link', record: 'NF-NOTE', message: 'NF-NOTE links to NF-NOTE-X9, which does not exist.' },
      { severity: 'error', check: 'meta-model', record: null, message: 'The meta-model names an unknown kind.' },
    ],
    coverage: [shopCoverage, payCoverage, noteCoverage],
  };
}
