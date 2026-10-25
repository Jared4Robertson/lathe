import { referenceFromWorkspace, type FormatReference } from '../../src/format/reference';
import { workspace } from './workspace';

// The format reference as the engine serves it at GET /api/format, for the fixture workspace: its
// kinds, relations and folders, with an ID convention for use cases, and documented checks (some
// name the kinds they concern, and one reports nothing now).

export function formatReference(): FormatReference {
  const ref = referenceFromWorkspace(workspace());
  return {
    ...ref,
    kinds: ref.kinds.map((k) => (k.kind === 'use_case' ? { ...k, id: { pattern: '<domain>-UC<nn>', example: 'DM-SHOP-UC01' } } : k)),
    checks: [
      { check: 'dangling-link', severity: 'error', severities: ['error'], summary: 'Every link points at a record that exists.', explanation: 'Fix the link, or add the record.', origin: 'lathe', source: 'checks/04-dangling-link.sql', kinds: [] },
      { check: 'test-file-missing', severity: 'error', severities: ['error'], summary: "A test's `run_by` file exists.", explanation: 'Point `run_by` at the file that runs the test.', origin: 'lathe', source: 'checks/20-test-file-missing.sql', kinds: ['test'] },
      { check: 'meta-model', severity: 'error', severities: ['error'], summary: 'The meta-model is consistent.', explanation: 'Fix the kinds or relations it names.', origin: 'engine', source: 'src/index.ts', kinds: [] },
      { check: 'unproved', severity: 'warning', severities: ['warning'], summary: 'Every obligation is proved by a test.', explanation: 'Add a test that **proves** it.', origin: 'lathe', source: 'checks/30-unproved.sql', kinds: ['requirement', 'domain_rule'] },
      { check: 'unsatisfied', severity: 'warning', severities: ['warning'], summary: 'Every obligation is satisfied by a component.', explanation: 'Add a component that satisfies it.', origin: 'lathe', source: 'checks/31-unsatisfied.sql', kinds: ['requirement', 'domain_rule'] },
      { check: 'use-case-without-flow', severity: 'warning', severities: ['warning'], summary: 'Every use case is carried out by a flow.', explanation: "Add it to a flow's `carries_out`.", origin: 'lathe', source: 'checks/40-use-case-without-flow.sql', kinds: ['use_case'] },
    ],
  };
}
