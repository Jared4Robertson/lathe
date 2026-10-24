---
id: LA-CHK-UC14-R04
kind: requirement
title: A test whose type does not suit what it proves is a warning
parent: LA-CHK-UC14
---
A test whose `test_type` is `domain_rule` (in any letter case) and that proves requirements but no domain rule, or whose `test_type` is `acceptance` and that proves domain rules but no requirement, MUST be reported as a `test-type-mismatch` warning naming what it proves. Other test types, such as `unit`, and tests that prove both MUST NOT be reported.
