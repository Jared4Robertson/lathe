---
id: LA-EXP-T158
kind: test
title: GET /api/history lists a record's commits through renames, the uncommitted change first, and one commit's diff
parent: LA-EXP
test_type: integration
run_by: lathe/test/history.test.ts
links:
  proves: [LA-EXP-E01-R01, LA-EXP-UC12-R05]
---
Against a temporary git repo of the good fixture with three commits (one a rename) and a change not committed, expects the record's file found from the specs by its ID, the commits newest first with their author, date, subject and hashes, `uncommitted: modified`, a commit's unified diff by its short hash, the working tree's diff, and nothing for a commit that did not touch the file.
