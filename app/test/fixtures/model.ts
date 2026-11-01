import type { ServedData } from '../read-view';
import type { Coverage, Problem } from '../../../lathe/src/types';
import { fixture } from './load';
import { recordIndexOf } from '../read-view';
import { gap, obligation } from './workspace';

// A product with a whole domain model, for the ERD view, the graph and the record pages
// (data/model/). P shares a value object (P-VO01 Name, with its constraint, value type and test) that
// both domains' fields use; a view, a UI component and an integration with its adapter, which only
// P-D's flow uses, sit in P-D. P-D (Domain, core):
// four aggregates (Thing, Member, Loan, Shelf) with entities whose fields are typed by the value
// object and by references to aggregates (Member's Account is P-E's), invariants, a specification
// reading two aggregates, events (Member joined published), commands raising them (Return thing
// records an exception: it also changes Thing), two policies (one hearing P-E's published Account
// closed), a read model with a query, a domain service and a term; a use case with its flow (a main
// and a refused path), two endpoints, technical records (a repository, a data model, a handler,
// tables with keys) and tests of several kinds; and an open question. P-E (Accounts) has Account
// with its published event (its Holder field typed by the value object) and the command raising it.

export const PROBLEMS: Problem[] = [
  { severity: 'error', check: 'test-file-missing', record: 'P-D-UC01-R01-T01', message: 'Test P-D-UC01-R01-T01 is run by test/lend.test.ts, which does not exist.' },
  { severity: 'warning', check: 'not-proved', record: 'P-D-INV02', message: 'No test proves invariant P-D-INV02.' },
];


const coverage = (): Coverage[] => [{
  product: 'P',
  domain: 'P-D',
  obligations: [
    obligation('invariant', 'Invariant', 2, 1, 1, 1),
    obligation('specification', 'Specification', 1, 0, 0, 0),
    obligation('policy', 'Policy', 2, 0, 0, 1),
    obligation('domain_service', 'Domain service', 1, 0, 0, 0),
    obligation('uc_requirement', 'UC requirement', 2, 2, 1, 1, 1),
  ],
  tests: { automated: 3, manual: 1, not_automated: 1 },
  proved_by: { 'P-D-INV01': ['P-D-INV01-T'], 'P-D-PO02': ['P-D-PO02-T'], 'P-D-UC01-R01': ['P-D-UC01-R01-T01'] },
  pattern_rules: [],
  debt: [],
  gaps: [
    gap('P-D-INV02', 'invariant', 'proved'),
    gap('P-D-UC01-R02', 'uc_requirement', 'proved'),
    // What no obligation's chain reaches, as the engine reports it (trace/chain.test.ts holds the app to it).
    gap('P-D-CMD02', 'command', 'record-untraced'),
    gap('P-D-CMD03', 'command', 'record-untraced'),
    gap('P-D-QRY01', 'query', 'record-untraced'),
    gap('P-D-UC01-FL01-S02', 'flow_step', 'record-untraced'),
  ] }, {
  product: 'P',
  domain: 'P-E',
  obligations: [],
  tests: { automated: 0, manual: 0, not_automated: 0 },
  proved_by: {},
  pattern_rules: [],
  debt: [],
  gaps: [gap('P-E-CMD01', 'command', 'record-untraced')] }];

export const modelWorkspace = (): ServedData => fixture('model', { problems: structuredClone(PROBLEMS), coverage: coverage() });

export const modelIndex = () => recordIndexOf(modelWorkspace());
