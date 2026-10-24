---
id: LA-CHK-C03
kind: component
title: Checks
parent: LA-CHK
component_type: sql checks
file: lathe/checks/
links:
  satisfies: [LA-CHK-UC01-R04, LA-CHK-UC01-R06, LA-CHK-UC02-R03, LA-CHK-UC03-R01, LA-CHK-UC05-R03, LA-CHK-DR02, LA-CHK-DR03, LA-CHK-DR05, LA-CHK-DR06, LA-CHK-DR08, LA-MOD-DR06, LA-MOD-DR07, LA-MOD-DR08, LA-MOD-DR09, LA-MOD-DR10, LA-MOD-DR11, LA-MOD-DR12]
---
The numbered SQL files, one check each: errors `duplicate-id`, `bad-id`, `unknown-kind`, `missing-title`, `missing-parent`, `unknown-parent`, `parent-kind-not-allowed`, `product-has-parent`, `missing-required-field`, `unknown-relation`, `relation-not-allowed`, `dangling-link`, `test-file-missing`, `test-file-missing-id`, `bad-test-state`, `test-run-by-missing`, `capability-order`, `pattern-setting-missing`, `bad-pattern-settings`; warnings `unsatisfied`, `unproved`, `use-case-without-requirements`, `component-file-missing`, `use-case-outside-capability`, `pattern-setting-clash`.

Meta-model checks, all errors with no record: `meta-duplicate-kind`, `meta-unknown-parent-kind`, `meta-unknown-relation-kind`, `meta-duplicate-relation`, `meta-bad-required-field`. Fitness checks, errors: `bad-fitness-date`, `bad-fitness-score`.
