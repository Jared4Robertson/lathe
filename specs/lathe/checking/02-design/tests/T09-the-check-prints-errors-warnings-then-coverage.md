---
id: LA-CHK-T09
kind: test
title: The check prints errors, then warnings, then coverage with designed, built and proved
parent: LA-CHK
test_type: acceptance
run_by: lathe/test/cli.test.ts
links:
  proves: [LA-CHK-UC01-R01]
---
Runs `lathe check` on a broken fixture and an unfinished one, and expects the errors section before the warnings section before the coverage lines, each coverage line giving designed, built and proved counts.
