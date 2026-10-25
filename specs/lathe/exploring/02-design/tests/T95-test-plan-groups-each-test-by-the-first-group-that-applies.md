---
id: LA-EXP-T95
kind: test
title: Test plan puts each test in one group by family, then by what it proves, empty groups left out
parent: LA-EXP
test_type: unit
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-EXP-UC09-R02, LA-EXP-DR24, LA-EXP-DR25, LA-EXP-DR28]
---
Expects tests in the seven groups (acceptance, domain rule, pattern, interaction, UI, design and engineering): a capability's test in Acceptance within its capability, acceptance tests by capability in order and by the first use case each proves, a test proving two kinds in the first group, a view's interaction requirement and `test_type` `ui` in UI tests, `test_type` `design` and a test with only `supports` links in Design checks, no empty groups, and no group level when only one group has tests.
