---
id: LA-CHK-T317
kind: test
title: A title not in the past tense is an event-tense warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-CHK-UC26-R05, LA-CHK-DR198]
---
Expects `event-tense` warnings for Open loan and Repair need, and none for titles ending in "-ed", with an irregular past form, with a past form after the subject, of one word, or in capitals with a hyphen.
