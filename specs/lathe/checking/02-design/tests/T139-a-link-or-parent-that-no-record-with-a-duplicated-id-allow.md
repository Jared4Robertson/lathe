---
id: LA-CHK-T139
kind: test
title: A link or parent that no record with a duplicated ID allows is still reported, once
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC14-R07]
---
Expects one `relation-not-allowed` and one `parent-kind-not-allowed` error, each naming both kinds the duplicated ID has.
