---
id: LA-CHK-UC12-R02
kind: requirement
title: "Each proved ID the file leaves out is an error"
parent: LA-CHK-UC12
---
When an automated test without a `key` has a `run_by` file that does not name the test's own ID, the engine MUST report one `proof-not-in-file` error on the test for each record the test proves whose ID the file does not name. The message MUST name the test, the proved ID and the file. The engine MUST NOT also report `test-file-missing-id` for that test.
