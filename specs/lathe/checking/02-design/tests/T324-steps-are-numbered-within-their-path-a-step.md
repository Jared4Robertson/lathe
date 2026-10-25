---
id: LA-CHK-T324
kind: test
title: Steps are numbered within their path; a step with no path is on the main path, and path names match trimmed in any case
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R03, LA-CHK-DR207, LA-CHK-DR110]
---
Expects no problem on a flow whose main path is written with and without its name and whose refused path, written as refused and as " Refused ", is numbered 1, 2 on its own.
