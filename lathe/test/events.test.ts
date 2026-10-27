// Domain events: the domain_event kind and its relations, its event_field rows as an entity's entity_field rows, what
// the store refuses (a reacts_to from a kind that may not react, a raised_by that is not an entity, a field without a
// name), and the checks entity-fields, event-unheard, event-tense and raised-by-outside-aggregate.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);
const data = everyKind();

let ws: Workspace;
beforeAll(async () => {
  // events: aggregate EVT-D-A1 (Loan) raises EV01 to EV10; EVT-D-A2 (Tool) reacts to EV01 and EV04, use case
  // EVT-D-UC01 to EV02.
  ws = await load('events');
});
afterAll(removeData);

describe('the schema', () => {
  it('LA-AUT-T88 A domain event sits under an aggregate in the domain model, is raised_by an entity, and is reacted to by aggregates, use cases and components', async () => {
    expect(ws.kinds.find((k) => k.kind === 'domain_event')).toMatchObject({
      stage: 'define', section: 'domain-model', parent_kinds: ['aggregate'], required_fields: [], obligation: false,
    });
    const rules = ws.relations
      .filter((r) => r.relation === 'raised_by' || r.relation === 'reacts_to')
      .map((r) => [r.relation, r.source_kind, r.target_kind, r.forward_label, r.reverse_label]);
    expect(rules).toEqual([
      ['raised_by', 'domain_event', 'entity', 'Raised by', 'Raises'],
      ['reacts_to', 'aggregate', 'domain_event', 'Reacts to', 'Reacted to by'],
      ['reacts_to', 'component', 'domain_event', 'Reacts to', 'Reacted to by'],
      ['reacts_to', 'use_case', 'domain_event', 'Reacts to', 'Reacted to by'],
    ]);
    expect(ws.links.filter((l) => l.target === 'EVT-D-EV01')).toEqual([
      { source: 'EVT-D-A2', relation: 'reacts_to', target: 'EVT-D-EV01' },
    ]);
    // A reacts_to from a kind that may not react, such as a domain rule, is refused by the store.
    const problems = await refusals(withTable(data, 'reacts_to', [...data.reacts_to, { source_id: 'TL-LEND-DR01', target_id: 'TL-LEND-EV01' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'reacts_to' })]);
    expect(problems[0].message).toContain('names no reacts_to_source (aggregate, component, use_case)');
  });
});

describe('event fields', () => {
  it("LA-AUT-T89 A domain event's fields are its event_field rows, in position order, as an entity's are", () => {
    const fields = (id: string) => ws.records.find((r) => r.id === id)?.parts.event_field?.map(({ name, meaning, type, example }) => ({ name, meaning, type, example }));
    expect(fields('EVT-D-EV01')).toEqual([
      { name: 'Loan ID', meaning: 'The loan.', type: 'Loan reference', example: 'Loan 31' },
      { name: 'Member', meaning: 'Who borrowed.', type: 'Member reference', example: 'Member 12' },
    ]);
    // An event with no fields has no event_field rows.
    expect(fields('EVT-D-EV04')).toBeUndefined();
    expect(ws.records.filter((r) => r.kind !== 'domain_event').every((r) => r.parts.event_field === undefined)).toBe(true);
  });

  it('LA-AUT-T90 A domain event with no fields is an entity-fields error naming it as an event; a field without a name, or named twice, is refused', async () => {
    expect(ofCheck(ws, 'entity-fields')).toEqual([{
      severity: 'error', check: 'entity-fields', record: 'EVT-D-EV04',
      message: 'Event EVT-D-EV04 lists no fields; add the fields it carries, each with its meaning and type.',
    }]);
    const [field] = data.event_field;
    expect(await refusals(withTable(data, 'event_field', [{ ...field, name: '' }]))).toEqual([expect.objectContaining({ rule: 'column', file: 'data/event_field.jsonl' })]);
    expect(await refusals(withTable(data, 'event_field', [field, { ...field, position: 2 }]))).toEqual([expect.objectContaining({ rule: 'unique', table: 'event_field' })]);
  });
});

describe('event checks', () => {
  it('LA-AUT-T91 A raised_by that names an entity of another aggregate is a raised-by-outside-aggregate error; a missing raised_by is not', async () => {
    expect(ofCheck(ws, 'raised-by-outside-aggregate')).toEqual([{
      severity: 'error',
      check: 'raised-by-outside-aggregate',
      record: 'EVT-D-EV03',
      message: "Event EVT-D-EV03 is raised_by EVT-D-EN03, which sits in EVT-D-A2, not in the event's aggregate EVT-D-A1; point raised_by at an entity of EVT-D-A1, or move the event under the aggregate that raises it.",
    }]);
    // EV04 has no raised_by. A raised_by to a record that does not exist, or is not an entity, is refused.
    for (const target of ['TL-LEND-EN99', 'TL-LEND-A1']) {
      const problems = await refusals(withTable(data, 'raised_by', [{ source_id: 'TL-LEND-EV01', target_id: target }]));
      expect(problems, target).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'raised_by' })]);
      expect(problems[0].message).toContain(`"${target}" names no entity`);
    }
  });

  it('LA-AUT-T92 An event that nothing reacts to is an event-unheard warning that says this can be fine; a reacts_to from any record hears it', () => {
    expect(recordsOf(ws, 'event-unheard')).toEqual(['EVT-D-EV03', 'EVT-D-EV05', 'EVT-D-EV06', 'EVT-D-EV07', 'EVT-D-EV08', 'EVT-D-EV09', 'EVT-D-EV10']);
    expect(ofCheck(ws, 'event-unheard').every((p) => p.severity === 'warning')).toBe(true);
    expect(ofCheck(ws, 'event-unheard')[0].message).toBe(
      'Nothing reacts to event EVT-D-EV03 (Open loan). That can be fine for an event kept for the record; otherwise link the aggregate that changes, the use case that starts or the component that handles it to EVT-D-EV03 with reacts_to.',
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
