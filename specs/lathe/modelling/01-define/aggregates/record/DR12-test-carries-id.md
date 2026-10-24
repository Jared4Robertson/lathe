---
id: LA-MOD-DR12
kind: domain_rule
title: A test's run_by file exists and contains the test's ID
parent: LA-MOD-A2
---
A `test` record's `run_by` path, relative to the repo root, MUST name a file that exists, and that file MUST contain the test record's ID, for example in the test's name. This is what ties the spec to the code that proves it.

A `component` record's `file` MAY name a file that does not exist yet; that is work still to do, not breakage.
