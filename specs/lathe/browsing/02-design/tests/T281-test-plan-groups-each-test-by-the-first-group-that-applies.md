---
id: LA-BRW-T281
kind: test
title: Test plan puts each test in the first group that applies, empty groups left out
parent: LA-BRW
test_type: unit
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-BRW-UC110-R02, LA-BRW-DR141, LA-BRW-DR142, LA-BRW-DR145]
---
Expects tests proving each kind of obligation in the five groups, acceptance tests by capability in order and by the first use case each proves, a test proving two kinds in the first group, no empty groups, and no group level when only one group has tests.
