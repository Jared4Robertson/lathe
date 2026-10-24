export type Kind = 'aggregate' | 'entity' | 'value_object' | 'domain_event' | 'term' | 'topic';
export type Status = 'decided' | 'draft' | 'open';

export interface Term {
  name: string;
  kind: Kind;
  context: string;
  status: Status;
  definition: string;
}

export interface Link {
  source: string;
  relation: string;
  target: string;
  cardinality: string | null;
  status: Status;
  note: string | null;
}

export interface DiagramSummary {
  slug: string;
  title: string;
  description: string | null;
}

export interface Model {
  terms: Term[];
  links: Link[];
  checks: { ok: boolean; message: string };
}
