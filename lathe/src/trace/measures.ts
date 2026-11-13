// How a business outcome is measured (LA-TRC-UC01-R18): the trace runs from an outcome to the aggregates, read models
// and journeys that serve it (serves) and to what measures it (measured_by), so an outcome nothing measures is as unfinished as one nothing
// serves. Spec: the shared module LA-TRC-MOD01, used by the coverage_gap projection (LA-TRC-RM02-PJ).
//
// What measures an outcome: a test of any kind, or a record of one of the product's own kinds (a report, a script,
// a check row) that the product allows by a product_relation named measured_by. A test counts only when it runs: it is
// manual, or automated with its file there and naming its ID, never "not automated yet". A record of a product's own
// kind counts as it is, since its own checks (a file that must exist) hold it. An outcome nothing in the code can
// measure (adoption by other repos, sales) says how it is measured outside the code in its measured_outside column
// instead, which the outcome's page shows.
import type { GapRule } from '../coverage.ts';

/** The coverage gaps of measuring outcomes, registered in coverage's GAP_RULES. */
export const MEASURE_GAPS: GapRule[] = [
  {
    name: 'outcome-not-measured',
    stage: 'discovery',
    kinds: ['business_outcome'],
    summary: 'A business outcome no running test or record measures, and that names no measure outside the code.',
    sql: () =>
      `SELECT o.id, 'Business outcome ' || o.id || ' is measured by nothing'
       || CASE WHEN EXISTS (SELECT 1 FROM measured_by m WHERE m.source_id = o.id) THEN ' that runs: each test that measures it is not automated yet, or its file is missing or does not name it' ELSE '' END
       || '; link the tests or records that measure it with measured_by, or say how it is measured outside the code.' AS message
FROM business_outcome o
WHERE o.measured_outside IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM measured_by m
    LEFT JOIN test_run t ON t.id = m.target_id
    WHERE m.source_id = o.id AND (t.id IS NULL OR (t.state <> 'not automated yet' AND t.backed)))`,
  },
];
