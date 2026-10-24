---
id: LA-CHK-T123
kind: test
title: "Mentions hold no repeats and never the record itself"
parent: LA-CHK
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC13-R01, LA-CHK-DR71]
---
Expects every record's mentions to be free of repeats and of its own ID, even when the body cites both.
