---
id: LA-BRW-T281
kind: test
title: Test plan puts each test in one group by family, then by what it proves, empty groups left out
parent: LA-BRW
test_type: unit
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-BRW-UC110-R02, LA-BRW-DR141, LA-BRW-DR142, LA-BRW-DR145]
---
Expects tests in the seven groups (acceptance, domain rule, pattern, interaction, UI, design and engineering): a capability's test in Acceptance within its capability, acceptance tests by capability in order and by the first use case each proves, a test proving two kinds in the first group, a view's interaction requirement and `test_type` `ui` in UI tests, `test_type` `design` and a test with only `supports` links in Design checks, no empty groups, and no group level when only one group has tests.
