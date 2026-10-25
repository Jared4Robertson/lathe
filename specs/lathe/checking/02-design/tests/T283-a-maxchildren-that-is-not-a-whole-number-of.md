---
id: LA-CHK-T283
kind: test
title: A maxChildren that is not a whole number of at least 1 is refused
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R02, LA-CHK-DR172]
---
Expects `loadConfig` and `loadWorkspace` to throw, naming `structure.maxChildren`, when it is a word.
