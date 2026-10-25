---
id: LA-AUT-T37
kind: test
title: Mentions hold no repeats and never the record itself
parent: LA-AUT
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC03-R01, LA-AUT-DR20]
---
Expects every record's mentions to be free of repeats and of its own ID, even when the body cites both.
