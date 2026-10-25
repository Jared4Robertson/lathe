---
id: LA-CHK-T263
kind: test
title: A kind in another stage's folder is a section-stage-mismatch error
parent: LA-CHK
test_type: unit
run_by: lathe/test/sections.test.ts
links:
  proves: [LA-CHK-UC21-R04, LA-CHK-DR152, LA-CHK-DR153]
---
Expects an error for a Design kind in a Define folder and for a kind of no stage in a Design folder, and none for patterns or any kind in the Shared folder.
