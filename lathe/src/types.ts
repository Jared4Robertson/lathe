// The shape the Lathe engine returns from loadWorkspace(root) and the web app reads from GET /api/spec: the typed
// records of the product's data/ folder, read through the store, with the problems the checks found and coverage.
import type { Row } from './store/rows.ts';
import type { IdScope, Stage } from './store/schema.ts';

export type { IdScope, Stage };

export interface Kind {
  kind: string;
  label: string;
  /** The stage its records belong to; null for a kind outside the stages (product, open question). */
  stage: Stage | null;
  /** Its place in the order people read kinds, from 1; null for a product's own kind, which follows Lathe's by name. */
  position: number | null;
  /** The kinds its records may sit under (none for a product or a kind with no owner; two for an endpoint or a table). */
  parent_kinds: string[];
  /** The columns every record of the kind must give, besides its id, title and parent columns. */
  required_fields: string[];
  /** An obligation must be designed, built and proved; coverage counts every obligation kind. */
  obligation: boolean;
  /** What its IDs start with: its product's, its domain's or its parent's ID; null when its IDs are free. */
  id_scope: IdScope | null;
  description: string;
}

/** A stage, in order: domain model, use cases, interaction design, technical specification, test plan. */
export interface StageRule {
  stage: Stage;
  position: number;
  label: string;
  description: string;
}

/** One pair of kinds a relation may link. */
export interface RelationRule {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  /** 'design': the link designs its target; 'proof': it proves it; '' otherwise. */
  role: 'design' | 'proof' | '';
  description: string;
  /** The link in plain words read from the source, in sentence case: "Fulfills". */
  forward_label: string;
  /** The link in plain words read from the target, in sentence case: "Fulfilled by". */
  reverse_label: string;
}

export interface SpecRecord {
  id: string;
  kind: string;
  title: string;
  /** The record it sits under: the one of its kind's parent columns that holds a value; null for a product and a kind with no owner. */
  parent: string | null;
  /** The product it sits in (itself for a product); a record with no owner takes it from its ID. */
  product: string | null;
  /** The domain it sits in (itself for a domain), or null outside every domain (a value object, a view, a pattern). */
  domain: string | null;
  /** The aggregate it sits in (itself for an aggregate), or null. */
  aggregate: string | null;
  /** The record's typed columns besides id and title, as stored, parent columns included: a requirement's statement, a test's level and state. */
  fields: Row;
  /** The rows of the part tables the record owns, by table, in key order: an entity's entity_field rows, a table's table_key rows. */
  parts: Record<string, Row[]>;
}

export interface SpecLink {
  source: string;
  relation: string;
  target: string;
}

export interface Problem {
  severity: 'error' | 'warning';
  /** The check's name, its row's `name` in the check table, e.g. 'unused'. */
  check: string;
  /** The record the problem is about, or null for workspace-level problems. */
  record: string | null;
  message: string;
}

/**
 * A recorded exception: a command that also changes another aggregate of its domain in the same transaction (a
 * command_change row), with the reason. Not a problem: lathe check lists every one, so each deviation stays deliberate
 * and visible.
 */
export interface RecordedException {
  /** The command. */
  command: string;
  /** The other aggregate it also changes. */
  aggregate: string;
  reason: string;
}

/** What one obligation, or one record that falls short of a minimum, still lacks. */
export interface CoverageGap {
  /** The record that falls short. */
  id: string;
  kind: string;
  /** For an obligation: designed, built or proved. Otherwise the minimum it misses: a gap rule's name, such as use-case-without-flow. */
  missing: string;
  message: string;
}

/** Coverage of one obligation kind in one domain (or in the product, outside every domain). */
export interface ObligationCoverage {
  kind: string;
  label: string;
  total: number;
  /** Its implementation is specified: a step fulfills a UC requirement, a predicate implements a specification, and so on. */
  designed: number;
  /** The technical record that implements it names a file that exists. */
  built: number;
  /** Its test exists, automated or manual, at a level its test kind allows (an automated test's file names it). */
  proved: number;
  /** Not proved, but a test of it is not automated yet. */
  not_automated: number;
  /** Only proof is asked of it (a pattern rule): designed and built count as its total. */
  proof_only: boolean;
}

/** How many tests a domain (or the product, outside every domain) has, by state. */
export interface TestCounts {
  automated: number;
  manual: number;
  not_automated: number;
}

/** Coverage of one domain, or of the product's records outside every domain (domain null). */
export interface Coverage {
  product: string;
  /** The domain, or null for the product's records outside every domain: value objects, views, integrations, UI components, standards and what sits under them. */
  domain: string | null;
  /** Every obligation kind in the schema, in kind order. */
  obligations: ObligationCoverage[];
  tests: TestCounts;
  /**
   * For each obligation proved here, the tests that count as its proof, in ID order: automated or manual, at a level
   * its test kind allows, an automated test's file naming it; for a pattern rule, those naming this domain. An
   * obligation not proved here is absent. The one answer to "proved": the app reads it, never works it out.
   */
  proved_by: Record<string, string[]>;
  /** The obligations not yet designed, built or proved, then the records short of a minimum (gap rules), by record. */
  gaps: CoverageGap[];
}

export interface Workspace {
  kinds: Kind[];
  /** The stages, in order. */
  stages: StageRule[];
  relations: RelationRule[];
  records: SpecRecord[];
  links: SpecLink[];
  problems: Problem[];
  /** Every recorded exception, by command and aggregate. */
  exceptions: RecordedException[];
  coverage: Coverage[];
}
