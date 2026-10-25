---
id: LA-CHK-T308
kind: test
title: lathe format prints the reference, or writes it with --out
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-UC25-R01]
---
Runs `lathe format` with and without `--out` on a product with an extension, and expects the rendered reference in both.
