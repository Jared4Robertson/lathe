// The shape the Lathe engine returns from loadWorkspace(root) and the web app reads from GET /api/spec.
// This file is the contract between the engine and the app: add fields if needed, never rename or remove.

export interface Kind {
  kind: string;
  label: string;
  /** 'define', 'design', or '' for structural kinds (product, domain, question). */
  stage: string;
  parent_kinds: string[];
  required_fields: string[];
  description: string;
}

export interface RelationRule {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
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
  kind: 'requirement' | 'domain_rule';
  missing: 'satisfies' | 'proves';
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
  relations: RelationRule[];
  records: SpecRecord[];
  links: SpecLink[];
  problems: Problem[];
  coverage: Coverage[];
}
