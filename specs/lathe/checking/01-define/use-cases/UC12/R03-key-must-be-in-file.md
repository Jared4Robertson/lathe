---
id: LA-CHK-UC12-R03
kind: requirement
title: "A test's key must be in its file"
parent: LA-CHK-UC12
---
When an automated test has a non-empty `key`, the engine MUST report a `test-file-missing-id` error, quoting the key, if the `run_by` file does not contain the key text exactly, and MUST NOT report `proof-not-in-file` for that test. If the file contains the key, the engine MUST report no claim of that test as unbacked.
