---
id: LA-TRC-UC03-R01
kind: requirement
title: An automated test's file names the test or every record it proves
parent: LA-TRC-UC03
---
An automated test's `run_by` file MUST name the test's own ID, or else every ID of a record the test links to with a `proof`-role relation (such as `proves`); a test with a `key` MUST instead have a file that contains the key. Each proved ID left out MUST be a `proof-not-in-file` error, and a missing key, or a missing ID of a test that proves nothing, a `test-file-missing-id` error, as LA-TRC-UC05 sets out.
