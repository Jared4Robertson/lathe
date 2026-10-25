---
id: LA-CHK-T262
kind: test
title: A kind naming a folder that is not listed is an unknown-section error
parent: LA-CHK
test_type: unit
run_by: lathe/test/sections.test.ts
links:
  proves: [LA-CHK-UC21-R03, LA-CHK-DR151]
---
Expects one `unknown-section` error naming the kind and the folder, and none for a kind with no section.
