---
id: LA-CHK-UC16-R02
kind: requirement
title: Coverage counts each domain's tests by state
parent: LA-CHK-UC16
---
Each domain's coverage MUST report `tests`: how many test records sit in the domain with each state, `automated`, `manual` and `planned`. A test with no `state` MUST count as automated, and a state MUST be read in any letter case. A domain with no tests MUST report zero of each.
