---
id: LA-CHK-T20
kind: test
title: A rule test keyed by its rule's ID gives one duplicate-id error and no cascaded errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R07, LA-CHK-DR06]
---
A probe from a trial on a real product: a test given its rule's ID. Expects the `duplicate-id` error and no error on the use case that applies the ID, the component that satisfies it or the test that proves it.
