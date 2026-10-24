---
id: LA-CHK-UC12-R01
kind: requirement
title: "A file that names the test's ID accepts all its claims"
parent: LA-CHK-UC12
---
When an automated test without a `key` has a `run_by` file that names the test's own ID, the engine MUST report no claim of that test as unbacked.
