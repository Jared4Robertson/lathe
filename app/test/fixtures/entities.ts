import type { SpecData } from '../../../lathe/src/server/contract';
import { testWorkspace } from '../graph/workspace';
import { fixture } from './load';

// The graph tests' workspace with a domain model for the Model view (data/entities/): four aggregates
// in P-D (Thing, Member, Loan, Shelf) with entities, their fields and their relationships, and another
// domain, P-E, whose Account a Member refers to. Shelf has no entities that refer anywhere; it relates
// to Thing instead.

export function entityWorkspace(): SpecData {
  const base = testWorkspace();
  return fixture('entities', { problems: base.problems, coverage: base.coverage });
}
