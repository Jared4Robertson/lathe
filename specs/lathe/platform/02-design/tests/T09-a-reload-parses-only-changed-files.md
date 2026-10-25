---
id: LA-PLT-T09
kind: test
title: A reload parses only the changed file and gives the same workspace as a fresh load
parent: LA-PLT
test_type: unit
run_by: lathe/test/reload-cache.test.ts
links:
  proves: [LA-PLT-DR02, LA-PLT-DR01]
---
Loads a copy of a fixture with an empty parse cache and expects every file parsed and every phase timed; loads again and expects nothing parsed and the same workspace; changes one record and expects one file parsed and the same workspace a fresh load gives. Expects the format reference to be the same object until the config changes.
