// The shape the Lathe engine returns from loadWorkspace(root) and the web app reads from GET /api/spec: the typed
// records of the product's data/ folder, read through the store, with the problems the checks found and coverage.
import type { Row } from './store/rows.ts';

export interface Kind {
  kind: string;
  label: string;
  /** 'define', 'design', or '' for structural kinds (product, domain, question). */
  stage: string;
  /** The folder the kind sits in within its stage ('' for none), from the schema's meta_section. */
  section: string;
  /** The kinds its records may sit under, nearest first. */
  parent_kinds: string[];
  /** The columns every record of the kind must give, besides its id, title and parent columns. */
  required_fields: string[];
  /** An obligation must be designed (satisfied), built and proved; coverage counts every obligation kind. */
  obligation: boolean;
  /** An obligation that needs proof only (obligation `proof` in the schema): designed and built are not asked of it. */
  proof_only: boolean;
  description: string;
}

/** A folder within a stage (or 'shared' at product level), from the schema's meta_section, in display order. */
export interface SectionRule {
  section: string;
  /** 'define', 'design', or '' for product-level folders such as Shared. */
  stage: string;
  order: number;
  label: string;
  description: string;
}

/** One pair of kinds a relation may link. */
export interface RelationRule {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  /** 'design': the link designs its target (counts as satisfied); 'proof': it proves it; '' otherwise. */
  role: 'design' | 'proof' | '';
  description: string;
  /** The link in plain words read from the source, in sentence case: "Satisfies". */
  forward_label: string;
  /** The link in plain words read from the target, in sentence case: "Designed by". */
  reverse_label: string;
}

export interface SpecRecord {
  id: string;
  kind: string;
  title: string;
  /** The record it sits under: the first of its kind's parent columns that holds a value; null for a product. */
  parent: string | null;
  /** The ID of the product this record sits under (itself for a product). */
  product: string | null;
  /** The ID of the domain this record sits under (itself for a domain), or null above domain level. */
  domain: string | null;
  /** The record's typed columns besides id and title, as stored, parent columns included: a requirement's statement, a test's given, when and then. */
  fields: Row;
  /** The rows of the part tables the record owns, by table, in key order: an entity's entity_field rows, a use case's use_case_step rows. */
  parts: Record<string, Row[]>;
}

export interface SpecLink {
  source: string;
  relation: string;
  target: string;
}

export interface Problem {
  severity: 'error' | 'warning';
  /** The check's name, its row's `name` in the check table, e.g. 'unproved'. */
  check: string;
  /** The record the problem is about, or null for workspace-level problems. */
  record: string | null;
  message: string;
}

export interface CoverageGap {
  id: string;
  /** Any obligation kind, such as requirement, domain_rule or interaction_requirement. */
  kind: string;
  missing: 'satisfies' | 'proves';
}

/** Coverage of one obligation kind in one domain. */
export interface ObligationCoverage {
  kind: string;
  label: string;
  total: number;
  /** A record linked to it by a 'design' relation exists. */
  designed: number;
  /** A component whose file exists designs it. */
  built: number;
  /** An automated or manual test proves it. */
  proved: number;
  /** Not proved, but a planned test is meant to prove it. */
  planned: number;
  /** Has a planned test meant to prove it, whether or not other tests already prove it (proof still owed). */
  planned_any: number;
}

/** How many tests a domain has, by state. */
export interface TestCounts {
  automated: number;
  manual: number;
  planned: number;
}

export interface Coverage {
  domain: string;
  /** Every obligation kind in the schema, in schema order, including requirement and domain_rule. */
  obligations: ObligationCoverage[];
  /** The domain's tests by state. */
  tests: TestCounts;
  gaps: CoverageGap[];
}

export interface Workspace {
  kinds: Kind[];
  /** The folders kinds sit in, in stage then order. */
  sections: SectionRule[];
  relations: RelationRule[];
  records: SpecRecord[];
  links: SpecLink[];
  problems: Problem[];
  coverage: Coverage[];
}
