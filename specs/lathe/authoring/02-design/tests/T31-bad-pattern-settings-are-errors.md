---
id: LA-AUT-T31
kind: test
title: A pattern's settings that are not valid field names are errors
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC05-R08, LA-AUT-DR17]
---
Expects `bad-pattern-settings` errors for `Bad-Name` and `title`, no missing-setting error for those names on the use case that follows the pattern, and no errors from other checks in the fixture.
