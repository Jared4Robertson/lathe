import type { EntityField, SpecRecord, Workspace } from '../../../lathe/src/types';
import { testWorkspace } from '../graph/workspace';

// The graph tests' workspace with a domain model for the Model view: four aggregates in P-D (Thing,
// Member, Loan, Shelf) with entities and their relationships, and another domain, P-E, whose Account
// a Member refers to. Shelf has no entities that refer anywhere; it relates to Thing instead.

const field = (f: string, kind: string): EntityField => ({ field: f, meaning: `The ${f.toLowerCase()}.`, kind, example: '1' });

function rec(id: string, kind: string, title: string, parent: string, domain: string, extra: Partial<SpecRecord> = {}): SpecRecord {
  return { id, kind, title, parent, product: 'P', domain, fields: {}, body: '', path: `specs/${id}.md`, mentions: [], ...extra };
}
const entity = (id: string, title: string, parent: string, role: 'root' | 'child', fields: EntityField[], domain = 'P-D') =>
  rec(id, 'entity', title, parent, domain, { fields: { role }, entityFields: fields });

export function entityWorkspace(): Workspace {
  const w = testWorkspace();
  w.records.push(
    rec('P-D-A2', 'aggregate', 'Member', 'P-D', 'P-D'),
    rec('P-D-A3', 'aggregate', 'Loan', 'P-D', 'P-D'),
    rec('P-D-A4', 'aggregate', 'Shelf', 'P-D', 'P-D'),
    entity('P-D-EN01', 'Thing', 'P-D-A1', 'root', [field('Thing ID', 'Whole number'), field('Name', 'Text')]),
    entity('P-D-EN02', 'Member', 'P-D-A2', 'root', [field('Member ID', 'Whole number')]),
    entity('P-D-EN03', 'Loan', 'P-D-A3', 'root', [field('Loan ID', 'Whole number'), field('Borrowed at', 'Date and time'), field('Due date', 'Date')]),
    entity('P-D-EN04', 'Return', 'P-D-A3', 'child', [field('Returned at', 'Date and time')]),
    entity('P-D-EN05', 'Reminder', 'P-D-A3', 'child', [field('Sent at', 'Date and time')]),
    rec('P-E', 'domain', 'Accounts', 'P', 'P-E'),
    rec('P-E-A1', 'aggregate', 'Account', 'P-E', 'P-E'),
    entity('P-E-EN01', 'Account', 'P-E-A1', 'root', [field('Account ID', 'Text')], 'P-E'),
  );
  w.links.push(
    { source: 'P-D-EN03', relation: 'has_one', target: 'P-D-EN04' },
    { source: 'P-D-EN03', relation: 'has_many', target: 'P-D-EN05' },
    { source: 'P-D-EN03', relation: 'refers_to', target: 'P-D-EN01' },
    { source: 'P-D-EN03', relation: 'refers_to', target: 'P-D-EN02' },
    { source: 'P-D-EN05', relation: 'refers_to', target: 'P-D-EN02' },
    { source: 'P-D-EN02', relation: 'refers_to', target: 'P-E-EN01' },
    { source: 'P-D-A4', relation: 'relates_to', target: 'P-D-A1' },
  );
  return w;
}
