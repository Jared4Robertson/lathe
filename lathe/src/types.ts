// The shape the Lathe engine returns from loadWorkspace(root) and the web app reads from GET /api/spec.
// This file is the contract between the engine and the app: add fields if needed, never rename or remove.

export interface Kind {
  kind: string;
  label: string;
  /** 'define', 'design', or '' for structural kinds (product, domain, question). */
  stage: string;
  /** The folder the kind sits in within its stage, from meta/sections.csv ('' for none), as Client lays out its specs. */
  section: string;
  parent_kinds: string[];
  required_fields: string[];
  /** An obligation must be designed (satisfied), built and proved; coverage counts every obligation kind. */
  obligation: boolean;
  /** An obligation that needs proof only (kinds.csv obligation value `proof`): designed and built are not asked of it. */
  proof_only: boolean;
  description: string;
}

/** A folder within a stage (or 'shared' at product level), from meta/sections.csv, in display order. */
export interface SectionRule {
  section: string;
  /** 'define', 'design', or '' for product-level folders such as Shared. */
  stage: string;
  order: number;
  label: string;
  description: string;
}

export interface RelationRule {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  /** 'design': the link designs its target (counts as satisfied); 'proof': it proves it; '' otherwise. */
  role: 'design' | 'proof' | '';
  description: string;
}

export interface SpecRecord {
  id: string;
  kind: string;
  title: string;
  parent: string | null;
  /** The ID of the product this record sits under (itself for a product). */
  product: string | null;
  /** The ID of the domain this record sits under (itself for a domain), or null above domain level. */
  domain: string | null;
  /** Every other plain header field, such as actor, method, route, run_by, file. */
  fields: Record<string, string>;
  /** The Markdown body. */
  body: string;
  /** The file path relative to the repo root. */
  path: string;
  /** IDs of existing records this record's body cites in its prose, in order of first mention. */
  mentions: string[];
}

export interface SpecLink {
  source: string;
  relation: string;
  target: string;
}

export interface Problem {
  severity: 'error' | 'warning';
  /** The check's name, from its SQL file name, e.g. 'unknown-kind'. */
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
  requirements: number;
  /** Designed: a component satisfies it (the component's file may not exist yet). */
  requirements_satisfied: number;
  /** Built: a component whose file exists satisfies it. Never more than requirements_satisfied. */
  requirements_built: number;
  requirements_proved: number;
  rules: number;
  rules_satisfied: number;
  rules_built: number;
  rules_proved: number;
  /** Every obligation kind in the meta-model, in meta-model order, including requirement and domain_rule (whose counts above are kept for older readers). */
  obligations: ObligationCoverage[];
  /** The domain's tests by state (a test with no state is automated). */
  tests: TestCounts;
  gaps: CoverageGap[];
}

// CSV diagrams (the app's Diagrams pages).

export interface DiagramSummary {
  slug: string;
  title: string;
  description: string | null;
}

export interface DiagramTerm {
  name: string;
  kind: string;
  context: string;
  status: 'decided' | 'draft' | 'open';
  definition: string;
}

export interface DiagramLink {
  source: string;
  relation: string;
  target: string;
  cardinality: string | null;
  status: 'decided' | 'draft' | 'open';
  note: string | null;
}

export interface DiagramModel {
  terms: DiagramTerm[];
  links: DiagramLink[];
  checks: { ok: boolean; message: string };
}

export interface Workspace {
  kinds: Kind[];
  /** The folders kinds sit in (meta/sections.csv), in stage then order. */
  sections: SectionRule[];
  relations: RelationRule[];
  records: SpecRecord[];
  links: SpecLink[];
  problems: Problem[];
  coverage: Coverage[];
}
