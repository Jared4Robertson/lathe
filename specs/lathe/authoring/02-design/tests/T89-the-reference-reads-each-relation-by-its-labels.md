---
id: LA-AUT-T89
kind: test
title: The reference reads each relation by its labels
parent: LA-AUT
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-AUT-UC12-R07]
---
Builds the default reference and expects each relation rule to carry its forward and reverse labels, the relations table to show both, and a requirement's links in to read as "Designed by" and "Proved by".
