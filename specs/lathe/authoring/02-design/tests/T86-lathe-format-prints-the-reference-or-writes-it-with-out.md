---
id: LA-AUT-T86
kind: test
title: lathe format prints the reference, or writes it with --out
parent: LA-AUT
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-AUT-UC12-R01]
---
Runs `lathe format` with and without `--out` on a product with an extension, and expects the rendered reference in both.
