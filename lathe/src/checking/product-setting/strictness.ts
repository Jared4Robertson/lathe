// Whether a product's check is strict (LA-CHK-UC01-R10, R11, R12), written once: the product's setting read as strict
// or not with the warnings it accepts, the warnings and gaps a check's run holds for one product, and the strict-check
// and strict-gaps errors the engine adds to every run (readWorkspace): a strict product's warnings that are not its
// accepted count, and any gap of a strict product, which no count ever accepts. Set it only with set-strict-check; no
// warning is ever silenced one by one.
import type { Coverage, Problem } from '../../types.ts';
import type { Row } from '../../platform/data/rows.ts';

/** A product's strictness: whether any warning or gap fails its check, and how many warnings it accepts while zero cannot be reached yet. */
export interface Strictness {
  strict: boolean;
  /** The warnings a strict check accepts, a recorded deviation; 0 for plain strict, and for a check that is not strict. Gaps have no such count. */
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

/** The product's gaps in the coverage: every scope's, its own and each domain's. */
export function gapsOf(coverage: readonly Pick<Coverage, 'product' | 'gaps'>[], product: string): number {
  return coverage.reduce((n, c) => n + (c.product === product ? c.gaps.length : 0), 0);
}

/** The engine's own check that a strict product's warnings fail it. */
export const STRICT_CHECK = 'strict-check';

/** The engine's own check that any gap fails a strict product. */
export const STRICT_GAPS = 'strict-gaps';

const warningCount = (n: number) => `${n} warning${n === 1 ? '' : 's'}`;
const gapCount = (n: number) => `${n} gap${n === 1 ? '' : 's'}`;

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

/** Why a strict product's check fails with this many gaps, or null when it has none (or the check is not strict). */
export function gapFailure(product: string, strictness: Strictness, gaps: number): string | null {
  if (!strictness.strict || gaps === 0) return null;
  return `Product ${product}'s check is strict, so any gap fails it, and it has ${gapCount(gaps)}: list them with coverage_gaps_list_coverage_gaps (lathe coverage-gaps list-coverage-gaps --product_id ${product}) or lathe check, and close ${gaps === 1 ? 'it' : 'each one'}; no count of gaps is ever accepted.`;
}

/**
 * The strict-check error of each strict product whose warnings in the run are not its accepted count, and the
 * strict-gaps error of each strict product with a gap in the coverage.
 */
export function strictProblems(settings: readonly Row[], problems: readonly Problem[], coverage: readonly Pick<Coverage, 'product' | 'gaps'>[], productOf: (record: string) => string | null | undefined): Problem[] {
  return settings.flatMap((setting) => {
    const product = String(setting.product_id);
    const strictness = strictnessOf(setting);
    const warnings = strictFailure(product, strictness, warningsOf(problems, product, productOf));
    const gaps = gapFailure(product, strictness, gapsOf(coverage, product));
    return [
      ...(warnings ? [{ severity: 'error' as const, check: STRICT_CHECK, record: product, message: warnings }] : []),
      ...(gaps ? [{ severity: 'error' as const, check: STRICT_GAPS, record: product, message: gaps }] : []),
    ];
  });
}

/** One product's strictness as its check judged it: its setting, its warnings and gaps, and why the check fails, if it does. */
export interface ProductStrictness extends Strictness {
  product: string;
  warnings: number;
  gaps: number;
  /** Why the strict check fails, on its warnings and then on its gaps; empty when it passes or is not strict. */
  failures: string[];
}

/** The strictness of each product the workspace holds, judged on its run. */
export function strictnessOfProducts(settings: readonly Row[], workspace: { records: readonly { id: string; kind: string; product: string | null }[]; problems: readonly Problem[]; coverage: readonly Pick<Coverage, 'product' | 'gaps'>[] }): ProductStrictness[] {
  const productOf = new Map(workspace.records.map((r) => [r.id, r.product]));
  const problems = workspace.problems.filter((p) => p.check !== STRICT_CHECK && p.check !== STRICT_GAPS);
  return workspace.records
    .filter((r) => r.kind === 'product')
    .map((r) => {
      const strictness = strictnessOf(settings.find((s) => s.product_id === r.id));
      const warnings = warningsOf(problems, r.id, (record) => productOf.get(record));
      const gaps = gapsOf(workspace.coverage, r.id);
      const failures = [strictFailure(r.id, strictness, warnings), gapFailure(r.id, strictness, gaps)].filter((f): f is string => f !== null);
      return { product: r.id, ...strictness, warnings, gaps, failures };
    });
}

/** The summary's word on a product's strictness: nothing when it is not strict. */
export function strictSummary(s: ProductStrictness): string {
  if (!s.strict) return '';
  const accepts = s.accepted ? `it accepts ${warningCount(s.accepted)} (a recorded deviation)` : 'it accepts none';
  const has = `has ${warningCount(s.warnings)} and ${gapCount(s.gaps)}`;
  const why = [
    ...(s.warnings > s.accepted ? [`${warningCount(s.warnings - s.accepted)} beyond the accepted count`] : []),
    ...(s.warnings < s.accepted ? [`fewer warnings than it accepts, so lower the accepted count to ${s.warnings}`] : []),
    ...(s.gaps ? [`${gapCount(s.gaps)}, and no gap is accepted`] : []),
  ];
  const head = `${s.product} is strict: warnings and gaps fail; ${accepts}, and ${has}`;
  return why.length ? `${head}, so its check fails: ${why.join('; ')}.` : `${head}.`;
}
