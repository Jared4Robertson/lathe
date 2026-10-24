---
id: LA-CHK-T23
kind: test
title: A fitness record's date must be a real YYYY-MM-DD date and its score 1 to 5
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC01-R06]
---
Loads fitness records with an impossible date, a date in another format, a score of 6, a score of 3.5 and no score, and expects `bad-fitness-date`, `bad-fitness-score` and `missing-required-field` errors on exactly those records.
