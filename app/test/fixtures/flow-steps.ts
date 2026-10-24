import type { SpecRecord, Workspace } from '../../../lathe/src/types';
import { workspace as fixtureWorkspace } from './workspace';

// Flow steps for the app tests (FORMAT.md section 14).

/** The fixture workspace with the flow_step kind and three steps under DM-SHOP-F01, written out of order. */
export function stepsWorkspace(): Workspace {
  const w = fixtureWorkspace();
  if (!w.kinds.some((k) => k.kind === 'flow_step')) {
    w.kinds.push({ kind: 'flow_step', label: 'Flow step', stage: 'design', parent_kinds: ['flow'], required_fields: ['order'], obligation: false, description: 'One step of a flow, in order.' });
  }
  const step = (id: string, order: string, title: string, body = ''): SpecRecord => ({
    id, kind: 'flow_step', title, parent: 'DM-SHOP-F01', product: 'DM', domain: 'DM-SHOP', fields: { order }, body, path: `specs/dm/${id}.md`, mentions: [],
  });
  w.records.push(
    step('DM-SHOP-F01-S01', '10', 'The basket shows the item', 'The basket page lists the **new item** at once.'),
    step('DM-SHOP-F01-S02', '1', 'The shopper picks an item'),
    step('DM-SHOP-F01-S03', '2', 'The page adds it to the basket', 'It calls the endpoint.'),
  );
  w.links.push(
    { source: 'DM-SHOP-F01-S02', relation: 'uses', target: 'DM-SHOP-V01' },
    { source: 'DM-SHOP-F01-S03', relation: 'uses', target: 'DM-SHOP-V01' },
    { source: 'DM-SHOP-F01-S03', relation: 'uses', target: 'DM-SHOP-E01' },
    { source: 'DM-SHOP-F01-S03', relation: 'fulfills', target: 'DM-SHOP-UC01-R02' },
    { source: 'DM-SHOP-F01-S03', relation: 'fulfills', target: 'DM-SHOP-DR01' },
    { source: 'DM-SHOP-F01-S01', relation: 'uses', target: 'DM-SHOP-V01' },
    { source: 'DM-SHOP-F01-S01', relation: 'fulfills', target: 'DM-SHOP-UC01-R01' },
  );
  w.problems.push({ severity: 'warning', check: 'flow-step-fulfills-outside-flow', record: 'DM-SHOP-F01-S03', message: 'Flow step DM-SHOP-F01-S03 fulfills DM-SHOP-DR01, which its flow DM-SHOP-F01 does not carry out.' });
  return w;
}
