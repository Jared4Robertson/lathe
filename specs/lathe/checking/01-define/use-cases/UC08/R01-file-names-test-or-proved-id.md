---
id: LA-CHK-UC08-R01
kind: requirement
title: An automated test's file names the test or a record it proves
parent: LA-CHK-UC08
---
An automated test's `run_by` file MUST mention the test's ID or the ID of a record the test links to with a `proof`-role relation (such as `proves`). If it mentions neither, the engine MUST report a `test-file-missing-id` error on the test.
