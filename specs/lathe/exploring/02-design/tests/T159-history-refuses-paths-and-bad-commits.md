---
id: LA-EXP-T159
kind: test
title: GET /api/history refuses a raw path or a bad commit, and says calmly when there is no git repository
parent: LA-EXP
test_type: integration
run_by: lathe/test/history.test.ts
links:
  proves: [LA-EXP-E01-R01, LA-EXP-DR56]
---
Expects 400 for a missing ID, a commit shaped like an option or a shell command, and a negative skip; 404 for a path given as the ID and for an unknown ID; and `no-repo` with a calm message for a folder outside any git repository.
