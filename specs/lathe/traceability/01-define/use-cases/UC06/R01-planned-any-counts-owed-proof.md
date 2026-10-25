---
id: LA-TRC-UC06-R01
kind: requirement
title: Coverage counts every obligation a planned test is meant to prove
parent: LA-TRC-UC06
---
Each obligation kind's coverage in a domain MUST report `planned_any`: how many of the domain's obligations of that kind a planned test is meant to prove, whether or not an automated or manual test already proves them. Two planned tests for one obligation MUST count it once. `planned` MUST keep counting only those not yet proved.
