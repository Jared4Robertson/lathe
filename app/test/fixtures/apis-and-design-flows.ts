import type { Kind, SpecRecord, Workspace } from '../../../lathe/src/types';
import { workspace as fixtureWorkspace } from './workspace';

// APIs, integrations and technical flows for the app tests (FORMAT.md sections 21 and 22).

const KINDS: Kind[] = [
  { kind: 'api', label: 'API', stage: 'design', section: 'interaction-design', parent_kinds: ['domain'], required_fields: [], obligation: false, proof_only: false, description: 'A group of endpoints for one resource.' },
  { kind: 'integration', label: 'Integration', stage: 'design', section: 'interaction-design', parent_kinds: ['domain'], required_fields: [], obligation: false, proof_only: false, description: 'An outside system the domain exchanges with.' },
  { kind: 'layer', label: 'Layer', stage: 'design', section: 'technical-specification', parent_kinds: ['domain', 'layer'], required_fields: ['order'], obligation: false, proof_only: false, description: 'An ordered part of a domain.' },
  { kind: 'design_flow', label: 'Technical flow', stage: 'design', section: 'technical-specification', parent_kinds: ['domain', 'layer'], required_fields: [], obligation: false, proof_only: false, description: 'How the system carries out a flow.' },
  { kind: 'design_step', label: 'Technical step', stage: 'design', section: 'technical-specification', parent_kinds: ['design_flow'], required_fields: ['order'], obligation: false, proof_only: false, description: 'One step of a technical flow.' },
];

/**
 * The fixture workspace with an API (DM-SHOP-API01) holding the endpoint DM-SHOP-E01 and a shared
 * requirement, an integration (DM-SHOP-INT01) with one exchange, and a technical flow (DM-SHOP-DF01)
 * in a Services layer that deepens DM-SHOP-F01, with two steps on the main path and one refused.
 */
export function apisWorkspace(): Workspace {
  const w = fixtureWorkspace();
  for (const kind of KINDS) if (!w.kinds.some((k) => k.kind === kind.kind)) w.kinds.push(kind);
  const record = (id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}, body = ''): SpecRecord => ({
    id, kind, title, parent, product: 'DM', domain: 'DM-SHOP', fields, body, path: `specs/dm/${id}.md`, mentions: [],
  });
  const endpoint = w.records.find((r) => r.id === 'DM-SHOP-E01')!;
  endpoint.parent = 'DM-SHOP-API01';
  const component = w.records.find((r) => r.id === 'DM-SHOP-C01')!;
  component.parent = 'DM-SHOP-LAY01';
  w.records.push(
    record('DM-SHOP-API01', 'api', 'Basket API', 'DM-SHOP'),
    record('DM-SHOP-API01-R01', 'interaction_requirement', 'An unknown basket answers 404', 'DM-SHOP-API01'),
    record('DM-SHOP-INT01', 'integration', 'Payments', 'DM-SHOP', { system: 'Card provider' }),
    record('DM-SHOP-INT01-R01', 'interaction_requirement', 'A paid basket is confirmed by the provider', 'DM-SHOP-INT01'),
    record('DM-SHOP-LAY01', 'layer', 'Services', 'DM-SHOP', { order: '1' }),
    record('DM-SHOP-DF01', 'design_flow', 'Fill a basket, in the services', 'DM-SHOP-LAY01'),
    record('DM-SHOP-DF01-S01', 'design_step', 'The service locks the basket and adds the item', 'DM-SHOP-DF01',
      { order: '1', transaction: 'add item', locks: 'the basket row', statements: '2' }, 'It checks the count **first**.'),
    record('DM-SHOP-DF01-S02', 'design_step', 'The service returns the basket', 'DM-SHOP-DF01', { order: '2' }),
    record('DM-SHOP-DF01-S03', 'design_step', 'The service refuses a full basket', 'DM-SHOP-DF01', { order: '1', path: 'refused' }),
  );
  w.links.push(
    { source: 'DM-SHOP-API01-R01', relation: 'fulfills', target: 'DM-SHOP-UC01-R02' },
    { source: 'DM-SHOP-INT01-R01', relation: 'fulfills', target: 'DM-SHOP-UC01-R01' },
    { source: 'DM-SHOP-DF01', relation: 'deepens', target: 'DM-SHOP-F01' },
    { source: 'DM-SHOP-DF01-S01', relation: 'uses', target: 'DM-SHOP-C01' },
    { source: 'DM-SHOP-DF01-S01', relation: 'satisfies', target: 'DM-SHOP-DR01' },
    { source: 'DM-SHOP-DF01-S01', relation: 'satisfies', target: 'DM-SHOP-UC01-R01' },
    { source: 'DM-SHOP-DF01-S02', relation: 'uses', target: 'DM-SHOP-C01' },
    { source: 'DM-SHOP-DF01-S03', relation: 'uses', target: 'DM-SHOP-C01' },
    { source: 'DM-SHOP-DF01-S03', relation: 'satisfies', target: 'DM-SHOP-UC01-R02' },
  );
  return w;
}
