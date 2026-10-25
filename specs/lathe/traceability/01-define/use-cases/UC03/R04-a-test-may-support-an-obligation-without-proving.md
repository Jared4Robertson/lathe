---
id: LA-TRC-UC03-R04
kind: requirement
title: A test may support an obligation without proving it
parent: LA-TRC-UC03
---
The meta-model MUST have a `supports` relation from a test to each obligation kind (UC requirement, domain rule, interaction requirement and pattern rule), with no role and the labels Supports and Supported by. A `supports` link MUST NOT count as proof, and MUST NOT raise `proof-not-in-file`, `proof-still-owed` or `test-file-missing-id`.
