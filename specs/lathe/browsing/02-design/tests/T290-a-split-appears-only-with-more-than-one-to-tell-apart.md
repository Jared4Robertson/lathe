---
id: LA-BRW-T290
kind: test
title: A split by kind or test group appears only with several to tell apart
parent: LA-BRW
test_type: component
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-BRW-DR144, LA-BRW-UC110-R04]
---
Expects a test plan with one group to list its tests directly in the nav and on the domain page; one with acceptance tests only to drop that level but keep its use cases; a folder of one kind to have no per-kind heading while one of three kinds has three; and children of one kind to carry no kind tag while a product's mixed children do.
