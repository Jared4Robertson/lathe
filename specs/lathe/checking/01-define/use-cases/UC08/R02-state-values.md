---
id: LA-CHK-UC08-R02
kind: requirement
title: A test's state is automated, manual or planned
parent: LA-CHK-UC08
---
A test's `state` MUST be `automated`, `manual` or `planned`; a test with no `state` is automated. Any other value MUST be reported as a `bad-test-state` error on the test.

The state MUST be read in any letter case, and the same way by the checks and by coverage.
