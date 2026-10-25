import type { EntityField, SpecRecord, Workspace } from '../../../lathe/src/types';
import { entityWorkspace } from './entities';

// The Model view's workspace with domain events (brief 60). Loan (P-D-A3) raises three events:
// Thing lent (raised by its Loan entity; Thing, Member, the Accounts domain's Account and the use
// case Lend a thing react), Thing returned (raised by Return; Thing reacts, and so does Loan itself,
// which draws no line) and Loan became overdue (raised by time passing: no raised_by; Member
// reacts). Accounts' Account raises Account closed, which Member reacts to.

const field = (f: string, kind: string): EntityField => ({ field: f, meaning: `The ${f.toLowerCase()}.`, kind, example: '1' });

const fieldsTable = (fields: EntityField[]) => [
  '## Fields',
  '',
  '| Field | Meaning | Kind of value | Example |',
  '| --- | --- | --- | --- |',
  ...fields.map((f) => `| ${f.field} | ${f.meaning} | ${f.kind} | ${f.example} |`),
].join('\n');

function event(id: string, title: string, parent: string, domain: string, fields: EntityField[]): SpecRecord {
  return {
    id, kind: 'domain_event', title, parent, product: 'P', domain, fields: {},
    body: `Something happened: ${title.toLowerCase()}.\n\n${fieldsTable(fields)}\n`,
    path: `specs/${id}.md`, mentions: [], entityFields: fields,
  };
}

export function eventWorkspace(): Workspace {
  const w = entityWorkspace();
  w.records.push(
    event('P-D-EV01', 'Thing lent', 'P-D-A3', 'P-D', [field('Loan ID', 'Whole number'), field('Thing', 'Thing reference')]),
    event('P-D-EV02', 'Thing returned', 'P-D-A3', 'P-D', [field('Loan ID', 'Whole number')]),
    event('P-D-EV03', 'Loan became overdue', 'P-D-A3', 'P-D', []),
    event('P-E-EV01', 'Account closed', 'P-E-A1', 'P-E', [field('Account ID', 'Text')]),
  );
  w.links.push(
    { source: 'P-D-EV01', relation: 'raised_by', target: 'P-D-EN03' },
    { source: 'P-D-EV02', relation: 'raised_by', target: 'P-D-EN04' },
    { source: 'P-E-EV01', relation: 'raised_by', target: 'P-E-EN01' },
    { source: 'P-D-A1', relation: 'reacts_to', target: 'P-D-EV01' },
    { source: 'P-D-A2', relation: 'reacts_to', target: 'P-D-EV01' },
    { source: 'P-E-A1', relation: 'reacts_to', target: 'P-D-EV01' },
    { source: 'P-D-UC01', relation: 'reacts_to', target: 'P-D-EV01' },
    { source: 'P-D-A1', relation: 'reacts_to', target: 'P-D-EV02' },
    { source: 'P-D-A3', relation: 'reacts_to', target: 'P-D-EV02' },
    { source: 'P-D-A2', relation: 'reacts_to', target: 'P-D-EV03' },
    { source: 'P-D-A2', relation: 'reacts_to', target: 'P-E-EV01' },
  );
  return w;
}
