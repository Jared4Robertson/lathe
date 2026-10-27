---
id: LA-CHK-C02
kind: component
title: Checks
parent: LA-CHK-LAY02
component_type: sql checks
file: lathe/checks/
links:
  satisfies: [LA-CHK-UC01-R04, LA-TRC-UC01-R03, LA-CHK-UC02-R01, LA-AUT-UC03-R03, LA-AUT-DR09, LA-AUT-DR10, LA-CHK-DR01, LA-CHK-DR02, LA-CHK-DR03, LA-AUT-DR01, LA-AUT-DR02, LA-AUT-DR03, LA-AUT-DR04, LA-AUT-DR05, LA-AUT-DR06, LA-AUT-DR07]
---
The numbered SQL files, one check each: errors `duplicate-id`, `bad-id`, `unknown-kind`, `missing-title`, `missing-parent`, `unknown-parent`, `parent-kind-not-allowed`, `product-has-parent`, `missing-required-field`, `unknown-relation`, `relation-not-allowed`, `dangling-link`, `test-file-missing`, `test-file-missing-id`, `proof-not-in-file`, `bad-test-state`, `test-run-by-missing`, `pattern-rule-setting-unknown`, `capability-order`, `pattern-setting-missing`, `bad-pattern-settings`; warnings `unsatisfied`, `unproved`, `use-case-without-requirements`, `component-file-missing`, `pattern-not-followed`, `obligation-outside-domain`, `unknown-id-in-prose`, `rule-not-applied`, `use-case-without-flow`, `interaction-requirement-fulfills-nothing`, `test-type-mismatch`, `component-satisfies-nothing`, `test-proves-nothing`, `use-case-outside-capability`, `pattern-setting-clash`.

Meta-model checks, all errors with no record: `meta-duplicate-kind`, `meta-unknown-parent-kind`, `meta-unknown-relation-kind`, `meta-duplicate-relation`, `meta-bad-required-field`.
