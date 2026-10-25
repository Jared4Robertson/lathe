---
id: LA-AUT-T61
kind: test
title: A kind naming a folder that is not listed is an unknown-section error
parent: LA-AUT
test_type: unit
run_by: lathe/test/sections.test.ts
links:
  proves: [LA-AUT-UC09-R03, LA-AUT-DR37]
---
Expects one `unknown-section` error naming the kind and the folder, and none for a kind with no section.
