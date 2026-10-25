---
id: LA-PLT-T01
kind: test
title: A product's lathe.config.json chooses the specs folder
parent: LA-PLT
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-PLT-UC01-R02]
---
Loads a fixture whose config names `docs/specs`, and checks that only records there are read and a stray file in `specs/` is ignored.
