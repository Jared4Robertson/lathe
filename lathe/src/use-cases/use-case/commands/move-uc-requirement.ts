import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { renamesUnder } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The requirement and the use case it moves to. */
export type MoveUcRequirement = Pick<UcRequirementRow, 'id' | 'use_case_id'>;

export const MOVE_UC_REQUIREMENT = {
  ...MOVE_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
    use_case_id: column('uc_requirement', 'use_case_id', 'required'),
  },
  handler: moveUcRequirement,
} satisfies CommandDefinition<MoveUcRequirement>;

// The requirement's ID is its use case's and R<nn>, so it takes the next number there, and its tests follow its ID.
export function moveUcRequirement(tx: Transaction, input: MoveUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const from = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  if (from.root === input.use_case_id) tx.refuse('parent', `${input.id} is already under ${input.use_case_id}`);
  const to = useCases.load(input.use_case_id) ?? tx.refuse('missing', `there is no use case ${input.use_case_id} to move ${input.id} to`);
  if (productOf(tx, from.useCase.capability_id) !== productOf(tx, to.useCase.capability_id)) tx.refuse('parent', `${input.use_case_id} is a use case of another product: ${input.id} moves only within its own`);
  const fulfilling = from.steps.filter((s) => s.fulfills.includes(input.id)).map((s) => s.row.id);
  if (fulfilling.length) tx.refuse('fulfilled', `${input.id} is fulfilled by ${fulfilling.join(', ')} of its own use case; change the step first, since a step fulfills only its own use case's requirements`);
  const highest = Math.max(0, ...to.requirements.map((r) => Number(/-R(\d+)$/.exec(r.id)?.[1] ?? 0)));
  const newId = `${input.use_case_id}-R${String(highest + 1).padStart(2, '0')}`;
  from.requirements = from.requirements.map((r) => (r.id === input.id ? { ...r, use_case_id: input.use_case_id } : r));
  holdToRules(tx, from);
  useCases.save(from);
  useCases.carryRenames(renamesUnder(tx, input.id, input.id, newId));
}

// The product a capability's domain belongs to.
function productOf(tx: Transaction, capabilityId: string): unknown {
  const domain = tx.record(capabilityId)?.row.domain_id;
  return typeof domain === 'string' ? tx.record(domain)?.row.product_id : undefined;
}
