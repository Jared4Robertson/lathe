import type { ServedData } from '../read-view';
import { fixture } from './load';
import { workspace } from './workspace';

// The component-test workspace with a standard (data/standards/): DM-STD-CODE in Shared with
// two rules. R01 (grouped under Transactions) is met by the command handler DM-SHOP-CMD01-H; R02 by
// the table DM-SHOP-EN01-TB.

export function standardWorkspace(): ServedData {
  const base = workspace();
  return fixture('standards', { problems: base.problems, coverage: base.coverage });
}
