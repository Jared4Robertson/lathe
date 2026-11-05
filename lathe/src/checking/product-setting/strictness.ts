// Whether a product's check is strict (LA-CHK-UC01-R10, R11), written once: the product's setting read as strict or
// not with the warnings it accepts, the warnings a check's run holds for one product, and the strict-check error the
// engine adds to every run (readWorkspace) when a strict product's warnings are not its accepted count. Set it only
// with set-strict-check; no warning is ever silenced one by one.
import type { Problem } from '../../types.ts';
import type { Row } from '../../platform/data/rows.ts';

/** A product's strictness: whether any warning fails its check, and how many it accepts while zero cannot be reached yet. */
export interface Strictness {
  strict: boolean;
  /** The warnings a strict check accepts, a recorded deviation; 0 for plain strict, and for a check that is not strict. */
  accepted: number;
}

/** The product's strictness from its settings row, or none: not strict by default. */
export function strictnessOf(setting: Row | undefined): Strictness {
  const strict = setting?.strict_check === true;
  return { strict, accepted: strict ? Number(setting?.accepted_warnings ?? 0) : 0 };
}

/** The run's warnings of the product: those about one of its records, and those about no record. */
export function warningsOf(problems: readonly Problem[], product: string, productOf: (record: string) => string | null | undefined): number {
  return problems.filter((p) => p.severity === 'warning' && (p.record === null || productOf(p.record) === product)).length;
}

/** The engine's own check that a strict product's warnings fail it. */
export const STRICT_CHECK = 'strict-check';

const warningCount = (n: number) => `${n} warning${n === 1 ? '' : 's'}`;

/** Why a strict product's check fails with this many warnings, or null when it passes (or the check is not strict). */
export function strictFailure(product: string, strictness: Strictness, warnings: number): string | null {
  if (!strictness.strict || warnings === strictness.accepted) return null;
  const accepts = strictness.accepted ? `accepts ${warningCount(strictness.accepted)}, a recorded deviation` : 'accepts none';
  if (warnings > strictness.accepted) {
    const fresh = warnings - strictness.accepted;
    return `Product ${product}'s check is strict and ${accepts}, and it has ${warningCount(warnings)}: fix the ${fresh === 1 ? 'warning' : `${fresh} warnings`} beyond the accepted count, since strict warnings fail it as errors do.`;
  }
  return `Product ${product}'s check is strict and ${accepts}, and it now has only ${warningCount(warnings)}: lower the accepted count to ${warnings} with set-strict-check, so the baseline only moves down and never hides a new warning.`;
}

/** The strict-check error of each strict product whose warnings in the run are not its accepted count. */
export function strictProblems(settings: readonly Row[], problems: readonly Problem[], productOf: (record: string) => string | null | undefined): Problem[] {
  return settings.flatMap((setting) => {
    const product = String(setting.product_id);
    const message = strictFailure(product, strictnessOf(setting), warningsOf(problems, product, productOf));
    return message ? [{ severity: 'error' as const, check: STRICT_CHECK, record: product, message }] : [];
  });
}

/** One product's strictness as its check judged it: its setting, its warnings, and why the check fails, if it does. */
export interface ProductStrictness extends Strictness {
  product: string;
  warnings: number;
  /** Why the strict check fails, or null when it passes or is not strict. */
  failure: string | null;
}

/** The strictness of each product the workspace holds, judged on its run. */
export function strictnessOfProducts(settings: readonly Row[], workspace: { records: readonly { id: string; kind: string; product: string | null }[]; problems: readonly Problem[] }): ProductStrictness[] {
  const productOf = new Map(workspace.records.map((r) => [r.id, r.product]));
  const problems = workspace.problems.filter((p) => p.check !== STRICT_CHECK);
  return workspace.records
    .filter((r) => r.kind === 'product')
    .map((r) => {
      const strictness = strictnessOf(settings.find((s) => s.product_id === r.id));
      const warnings = warningsOf(problems, r.id, (record) => productOf.get(record));
      return { product: r.id, ...strictness, warnings, failure: strictFailure(r.id, strictness, warnings) };
    });
}

/** The summary's word on a product's strictness: nothing when it is not strict. */
export function strictSummary(s: ProductStrictness): string {
  if (!s.strict) return '';
  const accepts = s.accepted ? `it accepts ${warningCount(s.accepted)} (a recorded deviation)` : 'it accepts none';
  if (s.warnings === s.accepted) return `${s.product} is strict: warnings fail; ${accepts}, and has ${s.warnings}.`;
  const why = s.warnings > s.accepted ? `${warningCount(s.warnings - s.accepted)} beyond the accepted count` : `fewer warnings than it accepts, so lower the accepted count to ${s.warnings}`;
  return `${s.product} is strict: warnings fail; ${accepts}, and has ${s.warnings}, so its check fails: ${why}.`;
}
