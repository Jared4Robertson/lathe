---
id: LA-EXP-T07
kind: test
title: The record page shows links out and in, grouped and named by their labels, each clickable
parent: LA-EXP
test_type: component
run_by: app/test/record-page.test.tsx
links:
  proves: [LA-EXP-UC02-R02, LA-TRC-UC14-R05]
---
Opens a requirement, checks its incoming links grouped under their reverse labels (Carried out in, Designed by, Proved by), follows the satisfying component's link, and checks that component's outgoing links under their forward labels (Implements, Satisfies).
