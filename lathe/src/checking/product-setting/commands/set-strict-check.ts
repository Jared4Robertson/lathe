import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { placementOf } from '../../../essential.ts';
import { DEFAULT_LIMITS } from '../model.ts';
import { ProductSettingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { STRICT_CHECK, warningsOf } from '../strictness.ts';
import { SET_STRICT_CHECK_IDENTITY } from './identities.generated.ts';

/** The product, whether its check is strict, and the warnings a strict check accepts (none when left out). */
export type SetStrictCheck = { product_id: string; strict_check: boolean; accepted_warnings?: number };

export const SET_STRICT_CHECK = {
  ...SET_STRICT_CHECK_IDENTITY,
  input: {
    product_id: column('product_setting', 'product_id', 'required'),
    strict_check: column('product_setting', 'strict_check', 'required'),
    accepted_warnings: column('product_setting', 'accepted_warnings', 'optional'),
  },
  checked: true,
  handler: setStrictCheck,
} satisfies CommandDefinition<SetStrictCheck>;

/**
 * Makes the product's check strict, accepting the given warnings, or not strict, keeping its limits and technology
 * words, and adds its one row (LA-CHK-INV05), with the default limits, the first time. Refused when it accepts
 * warnings for a check that is not strict, a negative count, or more warnings than the product has now in the checks'
 * run the runner gives it, so the accepted count only ever records warnings that are there.
 */
export function setStrictCheck(tx: Transaction, input: SetStrictCheck): void {
  const product = input.product_id;
  const accepted = input.accepted_warnings ?? 0;
  if (!input.strict_check && input.accepted_warnings !== undefined) tx.refuse('accepted-without-strict', `only a strict check accepts warnings; leave accepted_warnings out to make ${product}'s check not strict`);
  if (accepted < 0) tx.refuse('accepted-warnings', `accepted_warnings ${accepted} is not a count of warnings: give 0 or more`);
  if (input.strict_check) {
    const placement = placementOf(tx);
    // The strict-check error of the run itself is never one of the warnings counted.
    const now = warningsOf(tx.checkedProblems!.problems.filter((p) => p.check !== STRICT_CHECK), product, (record) => placement.productOf(record));
    if (accepted > now) tx.refuse('accepted-above-warnings', `${product} has ${now} warning${now === 1 ? '' : 's'} now, so its strict check cannot accept ${accepted}: accept ${now} or fewer, so the accepted count never hides a new warning`);
  }
  const settings = new ProductSettingRepository(tx);
  const setting = settings.load(product) ?? settings.create({ root: product, setting: { product_id: product, ...DEFAULT_LIMITS, technology_words: [] } });
  const { strict_check: _strict, accepted_warnings: _accepted, ...kept } = setting.setting;
  setting.setting = { ...kept, ...(input.strict_check ? { strict_check: true } : {}), ...(accepted ? { accepted_warnings: accepted } : {}) };
  holdToRules(tx, setting);
  settings.save(setting);
}
