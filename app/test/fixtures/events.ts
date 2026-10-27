import type { SpecData } from '../../../lathe/src/server/contract';
import { entityWorkspace } from './entities';
import { fixture } from './load';

// The Model view's workspace with domain events (data/events/, brief 60). Loan (P-D-A3) raises three
// events: Thing lent (raised by its Loan entity; Thing, Member, the Accounts domain's Account and the
// use case Lend a thing react), Thing returned (raised by Return; Thing reacts, and so does Loan
// itself, which draws no line) and Loan became overdue (raised by time passing: no raised_by; Member
// reacts). Accounts' Account raises Account closed, which Member reacts to.

export function eventWorkspace(): SpecData {
  const base = entityWorkspace();
  return fixture('events', { problems: base.problems, coverage: base.coverage });
}
