---
id: LA-CHK-T17
kind: test
title: Each check is one SELECT query in its own file, named by its file
parent: LA-CHK
test_type: unit
run_by: lathe/test/engine.test.ts
links:
  proves: [LA-CHK-DR08]
---
Reads every file in `lathe/checks/` and expects a numbered name, a single `SELECT` statement, and a `check` column equal to the file name without its number and `.sql`.
