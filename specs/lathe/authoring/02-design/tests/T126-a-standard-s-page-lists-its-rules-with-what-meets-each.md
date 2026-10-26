---
id: LA-AUT-T126
kind: test
title: A standard's page lists its rules with what meets each one
parent: LA-AUT
test_type: component
run_by: app/test/engineering-standards.test.tsx
links:
  proves: [LA-AUT-UC16-R04]
---
Opens a standard and expects its Rules table with the columns Rule and Met by, a met rule's row linking the component and the test that meet it, and Nothing yet for a rule nothing meets.
