// A field is named once in its entity or domain event as people read it: trimmed and in any letter case
// (migration 014). Exact names were unique already; these names differ only in spacing or case.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, StoreError, type StoreProblem } from '../../src/index.ts';
import { everyKind, removeData, withTable, writeData } from './fixture.ts';

afterAll(removeData);

async function loadRefused(root: string): Promise<StoreProblem[]> {
  try {
    const store = await openStore(root);
    await store.close();
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
  throw new Error('The data loaded, but it should have been refused.');
}

const loanId = { entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The loan number.', type: 'Whole number' };
const eventLoanId = { domain_event_id: 'TL-LEND-EV01', position: 1, name: 'Loan ID', meaning: 'Which loan.', type: 'Loan reference' };

describe('LA-AUT-T137 A field name is unique in its entity or event trimmed and in any letter case', () => {
  it('refuses an entity field named like another of the same entity but for spacing and case', async () => {
    const root = writeData(withTable(everyKind(), 'entity_field', [loanId, { ...loanId, position: 2, name: ' loan id ' }]));
    expect(await loadRefused(root)).toEqual([expect.objectContaining({ table: 'entity_field', file: expect.stringContaining('entity_field.jsonl'), line: 2 })]);
  });

  it('refuses a domain event field named like another of the same event but for case', async () => {
    const root = writeData(withTable(everyKind(), 'event_field', [eventLoanId, { ...eventLoanId, position: 2, name: 'LOAN ID' }]));
    expect(await loadRefused(root)).toEqual([expect.objectContaining({ table: 'event_field', file: expect.stringContaining('event_field.jsonl'), line: 2 })]);
  });

  it('refuses the same through the command layer, and changes nothing', async () => {
    const store = await openStore(writeData(everyKind()));
    await expect(store.add('entity_field', { ...loanId, position: 2, name: 'loan ID' })).rejects.toBeInstanceOf(StoreError);
    await expect(store.add('event_field', { ...eventLoanId, position: 2, name: 'Loan id ' })).rejects.toBeInstanceOf(StoreError);
    expect(store.rows('entity_field')).toHaveLength(1);
    expect(store.rows('event_field')).toHaveLength(1);
    await store.close();
  });

  it('keeps the same name in two entities, and two names that differ in more than spacing and case', async () => {
    const data = withTable(everyKind(), 'entity_field', [
      loanId,
      { ...loanId, position: 2, name: 'Loan IDs' },
      { ...loanId, entity_id: 'TL-LEND-EN02', name: 'loan id' },
    ]);
    const store = await openStore(writeData(data));
    expect(store.rows('entity_field')).toHaveLength(3);
    await store.close();
  });
});
