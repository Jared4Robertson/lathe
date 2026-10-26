---
id: LA-AUT-T122
kind: test
title: An applies_when that is malformed or names a setting the pattern lacks is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/groups-and-waivers.test.ts
links:
  proves: [LA-AUT-UC05-R09]
---
Expects `applies-when-unknown` errors for a rule that applies when "tone is red" under a pattern with no such setting and for one written "scope single", and expects both rules still owed wherever the pattern is followed.
