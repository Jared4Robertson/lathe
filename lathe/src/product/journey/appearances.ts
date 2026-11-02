// Where a use case or a policy sits in the product's journeys: the one way the Use case, Command and Journey read
// models learn the "why in time" of a record (LA-UCS-RM11, LA-MOD-RM28, LA-PRD-RM44). Read from the rows on each read.
import { byRecordId } from '../../platform/data/ids.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { JourneyRow, JourneyStepRow } from '../../platform/data/tables.ts';

/** A journey step as a neighbor reads it. */
export interface NamedStep {
  id: string;
  title: string;
}

/** One journey a use case or policy is a step of: the journey, the step, its path and position, and the steps before and after it on its path. */
export interface JourneyAppearance {
  journey: { id: string; title: string };
  step: NamedStep;
  path: string;
  position: number;
  before: NamedStep | null;
  after: NamedStep | null;
}

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
export const pathOf = (step: Pick<JourneyStepRow, 'path'>) => step.path?.trim().toLowerCase() || 'main';

/** The steps in order on their path: by position (a number), then by ID. */
export const inPathOrder = <T extends { position: number; id: string }>(steps: readonly T[]): T[] => [...steps].sort((a, b) => a.position - b.position || byRecordId(a, b));

/** The journeys each use case or policy is a step of, by its ID, in journey, path (main first) and position order. */
export function journeyAppearances(view: ReadView): (target: string) => JourneyAppearance[] {
  const journeys = new Map((view.rows('journey') as unknown as JourneyRow[]).map((j) => [j.id, j]));
  const steps = view.rows('journey_step') as unknown as JourneyStepRow[];
  const carried = new Map(view.rows('carries_out').map((l) => [String(l.source_id), String(l.target_id)]));
  const onPath = new Map<string, JourneyStepRow[]>();
  for (const step of steps) {
    const key = `${step.journey_id} ${pathOf(step)}`;
    onPath.set(key, [...(onPath.get(key) ?? []), step]);
  }
  const found = new Map<string, JourneyAppearance[]>();
  for (const [, own] of onPath) {
    const ordered = inPathOrder(own);
    ordered.forEach((step, at) => {
      const target = carried.get(step.id);
      const journey = journeys.get(step.journey_id);
      if (target === undefined || !journey) return;
      const named = (s: JourneyStepRow | undefined): NamedStep | null => (s ? { id: s.id, title: s.title } : null);
      found.set(target, [...(found.get(target) ?? []), { journey: { id: journey.id, title: journey.title }, step: { id: step.id, title: step.title }, path: pathOf(step), position: step.position, before: named(ordered[at - 1]), after: named(ordered[at + 1]) }]);
    });
  }
  for (const list of found.values()) {
    list.sort((a, b) => byRecordId(a.journey, b.journey) || (a.path === b.path ? 0 : a.path === 'main' ? -1 : b.path === 'main' ? 1 : a.path.localeCompare(b.path)) || a.position - b.position);
  }
  return (target) => found.get(target) ?? [];
}
