---
id: LA-TRC-UC03-R05
kind: requirement
title: A test that runs from a shared class names its key file
parent: LA-TRC-UC03
---
A test MAY name in `key_file` the file that holds its key, when it runs from a shared class in another file. With a `key_file`, `proof-not-in-file` and `test-file-missing-id` MUST look for the key, or the IDs, in that file, which MUST exist and sit under the product root. The test's `run_by` MUST still exist.
