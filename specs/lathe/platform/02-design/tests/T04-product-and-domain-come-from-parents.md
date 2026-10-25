---
id: LA-PLT-T04
kind: test
title: Each record's product and domain come from its parents, and a parent loop is an error
parent: LA-PLT
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-PLT-UC01-R02]
---
Expects each record in the good fixture to carry its product and domain, and a fixture with a parent loop to finish loading with a `parent-cycle` error on each record in the loop.
