---
id: LA-AUT-T04
kind: test
title: Two records with the same ID are an error, even in different products
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-DR01]
---
Loads a workspace in which two products each hold a record with the same ID and expects one `duplicate-id` error.
