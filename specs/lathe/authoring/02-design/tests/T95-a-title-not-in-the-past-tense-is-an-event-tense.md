---
id: LA-AUT-T95
kind: test
title: A title not in the past tense is an event-tense warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC13-R05, LA-AUT-DR63]
---
Expects `event-tense` warnings for Open loan and Repair need, and none for titles ending in "-ed", with an irregular past form, with a past form after the subject, of one word, or in capitals with a hyphen.
