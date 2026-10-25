---
id: LA-CHK-T51
kind: test
title: A component or test with no purpose is a warning that breaks nothing
parent: LA-CHK
test_type: domain_rule
run_by: lathe/test/purpose.test.ts
links:
  proves: [LA-CHK-DR28]
---
Expects both checks to report only warnings, with no errors besides the dangling link the fixture means to have, and none in a workspace where every component and test serves an obligation.
