---
id: LA-CHK-C03
kind: component
title: Checks
parent: LA-CHK
component_type: sql checks
file: lathe/checks/
links:
  satisfies: [LA-CHK-UC01-R04, LA-CHK-UC02-R03, LA-CHK-UC03-R01, LA-CHK-DR03, LA-CHK-DR05, LA-CHK-DR06, LA-CHK-DR08, LA-MOD-DR06, LA-MOD-DR07, LA-MOD-DR08, LA-MOD-DR09, LA-MOD-DR10, LA-MOD-DR11, LA-MOD-DR12]
---
The numbered SQL files, one check each: errors `duplicate-id`, `bad-id`, `unknown-kind`, `missing-title`, `missing-parent`, `unknown-parent`, `parent-kind-not-allowed`, `product-has-parent`, `missing-required-field`, `unknown-relation`, `relation-not-allowed`, `dangling-link`, `test-file-missing`, `test-file-missing-id`; warnings `unsatisfied`, `unproved`, `use-case-without-requirements`, `component-file-missing`.

No check yet covers the meta-model's own consistency (`LA-CHK-DR02`).
