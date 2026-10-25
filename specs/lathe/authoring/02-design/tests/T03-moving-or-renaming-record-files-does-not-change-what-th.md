---
id: LA-AUT-T03
kind: test
title: Moving or renaming record files does not change what they mean, and README.md is ignored
parent: LA-AUT
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-AUT-UC01-R03]
---
Copies every record of the clean workspace, flat and renamed, into one folder next to a `README.md` with no header, and expects the same records, links and coverage.
