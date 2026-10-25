---
id: LA-AUT-DR07
kind: domain_rule
title: A test's run_by file exists and contains the test's ID
parent: LA-AUT-EN22
---
An automated `test` record's `run_by` path, relative to the repo root, MUST name a file that exists, and that file MUST contain the test record's ID or else every ID of a record the test proves, for example in the test's name. A test with a `key` field MUST instead have a file that contains the key text. This is what ties the spec to the code that proves it. A manual or planned test needs no `run_by`; if it gives one, the file MUST exist.

A `component` record's `file` MAY name a file that does not exist yet; that is work still to do, not breakage.
