import type { JourneyAppearance } from '../../../../lathe/src/authoring/journey/appearances';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink } from '../../specs/parts';

// "In journeys" on a use case's or a policy's page: where it sits in time, each journey it is a step of (LA-AUT-RM11,
// LA-AUT-RM28), as "Step 2 of TL-JR01 Get a damaged tool back in lending · previous: TL-JR01-S01 · next: TL-JR01-S03", each a link. With the
// Serves line it answers why the record exists: what it is for, and when in a journey it happens. A policy is a handoff
// there.

/** One journey the record is a step of: its step number on its path (the path when not the main one), the journey and the step after it. */
function Appearance({ index, appearance }: { index: RecordIndex; appearance: JourneyAppearance }) {
  const { journey, path, position, before, after } = appearance;
  return (
    <li data-journey={journey.id}>
      Step {position} of <RecordLink index={index} id={journey.id} />{path !== 'main' && <small className="meta" data-meta="path"> · path: {path}</small>}
      {before && <small className="meta" data-meta="previous"> · previous: <RecordLink index={index} id={before.id} showTitle={false} /> {before.title}</small>}
      {after && <small className="meta" data-meta="next"> · next: <RecordLink index={index} id={after.id} showTitle={false} /> {after.title}</small>}
    </li>
  );
}

/** The "In journeys" fact's value, or null when the record is in none. */
export function InJourneys({ index, journeys, id }: { index: RecordIndex; journeys: readonly JourneyAppearance[]; id: string }) {
  if (journeys.length === 0) return null;
  return <ul className="plain in-journeys" aria-label={`Journeys ${id} is a step of`}>{journeys.map((a) => <Appearance key={a.step.id} index={index} appearance={a} />)}</ul>;
}
