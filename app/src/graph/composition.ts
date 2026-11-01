// What nests in the Graph's Map layout (LA-STD-MODELING-R14, LA-EXP-DS12): a record is drawn inside its parent only
// when it cannot exist without it and belongs wholly to it, its composition. Everything else a record is joined to,
// its parent included, is a link, drawn as a line when it is relevant (the focus's and the selection's).

/** Each parent kind's composed child kinds: the Owner-approved list (LA-STD-MODELING-R14). */
const COMPOSED: Readonly<Record<string, readonly string[]>> = {
  aggregate: ['entity'],
  entity: ['command'],
  journey: ['journey_step'],
  use_case: ['uc_requirement', 'flow'],
  flow: ['flow_step'],
  pattern: ['pattern_rule'],
  standard: ['standard_rule'],
  value_object: ['constraint'],
  read_model: ['query', 'projection', 'reader'],
  endpoint: ['api_requirement'],
  view: ['view_requirement'],
};

/** Whether a kind is a test: each record's tests are its own, wherever they are filed (the test plan). */
const isTestKind = (kind: string) => kind.endsWith('_test');

/** Whether a record of `child` kind nests inside its parent of `parent` kind in the Map layout. */
export function composes(parent: string, child: string): boolean {
  return isTestKind(child) || (COMPOSED[parent]?.includes(child) ?? false);
}
