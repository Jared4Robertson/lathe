// Domain events (FORMAT.md section 18): the domain_event kind and its relations, the Fields table read into
// entityFields as for entities, and the checks entity-fields, event-unheard, event-tense and
// raised-by-outside-aggregate.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);

let ws: Workspace;
beforeAll(async () => {
  // events: aggregate EVT-D-A1 (Loan) raises EV01 to EV10; EVT-D-A2 (Tool) reacts to EV01 and EV04, use case
  // EVT-D-UC01 to EV02, and domain rule EVT-D-DR01, which may not, to EV05. EVT-D-EN09 is in both aggregates.
  ws = await loadWorkspace(fixture('events'));
});

describe('the meta-model', () => {
  it('LA-AUT-T88 A domain event sits under an aggregate in the domain model, is raised_by an entity, and is reacted to by aggregates, use cases and components', () => {
    expect(ws.kinds.find((k) => k.kind === 'domain_event')).toMatchObject({
      stage: 'define', section: 'domain-model', parent_kinds: ['aggregate'], required_fields: [], obligation: false,
    });
    const rules = ws.relations
      .filter((r) => r.relation === 'raised_by' || r.relation === 'reacts_to')
      .map((r) => [r.relation, r.source_kind, r.target_kind, r.forward_label, r.reverse_label]);
    expect(rules).toEqual([
      ['raised_by', 'domain_event', 'entity', 'Raised by', 'Raises'],
      ['reacts_to', 'aggregate', 'domain_event', 'Reacts to', 'Reacted to by'],
      ['reacts_to', 'use_case', 'domain_event', 'Reacts to', 'Reacted to by'],
      ['reacts_to', 'component', 'domain_event', 'Reacts to', 'Reacted to by'],
    ]);
    expect(ws.links.filter((l) => l.target === 'EVT-D-EV01')).toEqual([
      { source: 'EVT-D-A2', relation: 'reacts_to', target: 'EVT-D-EV01' },
    ]);
    // A reacts_to from a kind the meta-model does not allow is relation-not-allowed.
    expect(recordsOf(ws, 'relation-not-allowed')).toEqual(['EVT-D-DR01', 'EVT-D-EV09']);
  });
});

describe('the Fields table', () => {
  it('LA-AUT-T89 A domain event\'s Fields table is read into entityFields in table order, as an entity\'s is', () => {
    const fields = (id: string) => ws.records.find((r) => r.id === id)?.entityFields;
    expect(fields('EVT-D-EV01')).toEqual([
      { field: 'Loan ID', meaning: 'The loan.', kind: 'Loan reference', example: 'Loan 31' },
      { field: 'Member', meaning: 'Who borrowed.', kind: 'Member reference', example: 'Member 12' },
    ]);
    // A table with the wrong columns gives no fields; an event with no table has none either.
    expect(fields('EVT-D-EV05')).toEqual([]);
    expect(fields('EVT-D-EV04')).toEqual([]);
    expect(ws.records.filter((r) => !['entity', 'domain_event'].includes(r.kind)).every((r) => r.entityFields === undefined)).toBe(true);
  });

  it('LA-AUT-T90 A domain event with no Fields table, the wrong columns, a repeated field or a row with no name is an entity-fields error naming it as an event', () => {
    expect(ofCheck(ws, 'entity-fields')).toEqual([
      {
        severity: 'error', check: 'entity-fields', record: 'EVT-D-EV04',
        message: 'Event EVT-D-EV04 has no ## Fields table; add a "## Fields" heading with a table of the columns Field, Meaning, Kind of value and Example, one row per field.',
      },
      {
        severity: 'error', check: 'entity-fields', record: 'EVT-D-EV05',
        message: "Event EVT-D-EV05's Fields table has the columns Field, Meaning, Type, Example; use the columns Field, Meaning, Kind of value and Example, in that order.",
      },
      {
        severity: 'error', check: 'entity-fields', record: 'EVT-D-EV06',
        message: "Event EVT-D-EV06's Fields table has no field name in row 3; name the field, or remove the row.",
      },
      {
        severity: 'error', check: 'entity-fields', record: 'EVT-D-EV06',
        message: 'Event EVT-D-EV06\'s Fields table lists the field "Amount" 2 times, in rows 1, 2; name each field once.',
      },
    ]);
  });
});

describe('event checks', () => {
  it('LA-AUT-T91 A raised_by that names an entity of another aggregate is a raised-by-outside-aggregate error; a missing raised_by is not', () => {
    expect(ofCheck(ws, 'raised-by-outside-aggregate')).toEqual([{
      severity: 'error',
      check: 'raised-by-outside-aggregate',
      record: 'EVT-D-EV03',
      message: "Event EVT-D-EV03 is raised_by EVT-D-EN03, which sits in EVT-D-A2, not in the event's aggregate EVT-D-A1; point raised_by at an entity of EVT-D-A1, or move the event under the aggregate that raises it.",
    }]);
    // EV04 has no raised_by; EV08's target does not exist and EV09's is not an entity, which other checks
    // report; EV10's target EN09 is duplicated, and one copy sits in the event's aggregate.
    expect(recordsOf(ws, 'dangling-link')).toEqual(['EVT-D-EV08']);
  });

  it('LA-AUT-T92 An event that nothing reacts to is an event-unheard warning that says this can be fine; a reacts_to from any record hears it', () => {
    expect(recordsOf(ws, 'event-unheard')).toEqual(['EVT-D-EV03', 'EVT-D-EV06', 'EVT-D-EV07', 'EVT-D-EV08', 'EVT-D-EV09', 'EVT-D-EV10']);
    expect(ofCheck(ws, 'event-unheard').every((p) => p.severity === 'warning')).toBe(true);
    expect(ofCheck(ws, 'event-unheard')[0].message).toBe(
      'Nothing reacts to event EVT-D-EV03 (Open loan). That can be fine for an event kept for the record; otherwise add reacts_to: [EVT-D-EV03] to the aggregate that changes, the use case that starts or the component that handles it when it happens.',
    );
  });

  it('LA-AUT-T93 A title with no past form as its last word or after its first is an event-tense warning', () => {
    // Passing: Loan opened, Tool returned (-ed); Loan became overdue (a past form after the subject); Fine paid,
    // Note written (irregular); Registered (one word); META-MODEL CHANGED (any case, split at the hyphen).
    // Failing: Open loan; Repair need, whose -ed ending is not a past form.
    expect(ofCheck(ws, 'event-tense')).toEqual([
      {
        severity: 'warning', check: 'event-tense', record: 'EVT-D-EV03',
        message: 'Event EVT-D-EV03 is titled "Open loan", which does not read as past tense; name it for what happened, such as "Loan opened" or "Tool returned".',
      },
      {
        severity: 'warning', check: 'event-tense', record: 'EVT-D-EV08',
        message: 'Event EVT-D-EV08 is titled "Repair need", which does not read as past tense; name it for what happened, such as "Loan opened" or "Tool returned".',
      },
    ]);
  });
});
