---
id: LA-CHK-UC12-R04
kind: requirement
title: "A test that proves nothing still needs its ID in its file"
parent: LA-CHK-UC12
---
When an automated test without a `key` proves no record and its `run_by` file does not name the test's own ID, the engine MUST report a `test-file-missing-id` error.
