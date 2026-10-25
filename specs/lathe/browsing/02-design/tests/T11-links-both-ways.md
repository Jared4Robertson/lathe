---
id: LA-BRW-T11
kind: test
title: "The record page shows links out and in, grouped and named by their labels, each clickable"
parent: LA-BRW
test_type: component
run_by: app/test/record-page.test.tsx
links:
  proves: [LA-BRW-UC03-R02, LA-BRW-UC118-R05]
---
Opens a requirement, checks its incoming links grouped under their reverse labels (Carried out in, Designed by, Proved by), follows the satisfying component's link, and checks that component's outgoing links under their forward labels (Implements, Satisfies).
