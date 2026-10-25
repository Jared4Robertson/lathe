---
id: LA-AUT-T62
kind: test
title: A kind in another stage's folder is a section-stage-mismatch error
parent: LA-AUT
test_type: unit
run_by: lathe/test/sections.test.ts
links:
  proves: [LA-AUT-UC09-R04, LA-AUT-DR38, LA-AUT-DR39]
---
Expects an error for a Design kind in a Define folder and for a kind of no stage in a Design folder, and none for patterns or any kind in the Shared folder.
