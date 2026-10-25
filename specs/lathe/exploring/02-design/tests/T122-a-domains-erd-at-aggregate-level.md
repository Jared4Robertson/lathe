---
id: LA-EXP-T122
kind: test
title: A domain's ERD draws each aggregate with its root and entity count, one many-to-one line per aggregate pair and direction, relates_to dashed as a fallback, and another domain's aggregates gray
parent: LA-EXP
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-EXP-UC11-R02, LA-EXP-DR38]
---
Builds a domain's ERD and expects its four aggregates and the referenced one from another domain, gray with its domain in parentheses, the root and entity count on a box, two references between one pair drawn as one line, and a dashed relates_to line for an aggregate whose entities refer to none; then draws it and expects the boxes and lines.
