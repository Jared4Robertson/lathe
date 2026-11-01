// The Coverage gaps reads (LA-TRC-RM02): a product's gaps, and the one of them that names the packages no record uses,
// answered from the read model through its reader (reader.ts). The gaps are the checks' run's, so each query says it
// reads the run (`checked`): the server gives it the run it keeps for the data, the CLI and the MCP tool run the checks
// first. Its handlers never see the data and change nothing. This slice holds only reads, so it names its read model
// where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { CoverageGapRow } from './read-model.ts';
import { coverageGapsReader, type CoverageGapsReader } from './reader.ts';
import { LIST_COVERAGE_GAPS_IDENTITY, FIND_UNUSED_PACKAGES_IDENTITY } from './queries.generated.ts';

/** A product's gaps, as the Coverage gaps queries answer them. */
export interface ProductGaps {
  product: string;
  gaps: CoverageGapRow[];
}

/** The gap rule that names a product's packages no record uses (coverage.ts). */
const UNUSED_PACKAGES = 'package-not-accounted-for';

const gapsOf = (reader: CoverageGapsReader, product: string): CoverageGapRow[] => {
  const gaps = reader.gapsOf(product);
  if (!gaps) throw new StoreError([{ rule: 'missing', message: `there is no product ${product}` }]);
  return gaps;
};

const gapsText = (p: ProductGaps, none: string) =>
  [`${p.product}: ${p.gaps.length ? `${p.gaps.length} gap${p.gaps.length === 1 ? '' : 's'}` : none}`, ...p.gaps.map((g) => `  ${g.id} (${g.domain ?? 'Shared'}) ${g.missing}: ${g.message}`)].join('\n');

/** Every gap of the product: its own scope's, then each domain's. */
export function listCoverageGaps(reader: CoverageGapsReader, input: { product_id: string }): ProductGaps {
  return { product: input.product_id, gaps: gapsOf(reader, input.product_id) };
}

/** The product's package-not-accounted-for gap, naming each package no record uses with its manifests, or none. */
export function findUnusedPackages(reader: CoverageGapsReader, input: { product_id: string }): ProductGaps {
  return { product: input.product_id, gaps: gapsOf(reader, input.product_id).filter((g) => g.missing === UNUSED_PACKAGES) };
}

/** List coverage gaps (LA-TRC-QRY02). */
export const LIST_COVERAGE_GAPS: QueryDefinition<{ product_id: string }, ProductGaps, CoverageGapsReader> = {
  ...LIST_COVERAGE_GAPS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: coverageGapsReader,
  run: listCoverageGaps,
  text: (p) => gapsText(p, 'no gaps'),
};

/** Find the packages no record uses (LA-TRC-QRY12). */
export const FIND_UNUSED_PACKAGES: QueryDefinition<{ product_id: string }, ProductGaps, CoverageGapsReader> = {
  ...FIND_UNUSED_PACKAGES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: coverageGapsReader,
  run: findUnusedPackages,
  text: (p) => gapsText(p, 'every package is used by a record'),
};
