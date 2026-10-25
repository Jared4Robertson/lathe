---
id: LA-MOD-T17
kind: test
title: A clashing or empty title is refused, says why, and writes nothing
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC01-R03, LA-MOD-DR01]
---
Tries titles whose slug is registered or already a folder, and titles with no letters or numbers, and expects an error naming the slug where there is one and no file changed.
