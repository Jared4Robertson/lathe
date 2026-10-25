---
id: LA-EXP-T102
kind: test
title: Group labels name kinds through plural(), and opened groups last the session
parent: LA-EXP
test_type: component
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-EXP-DR29, LA-EXP-UC09-R03]
---
Renames two kinds and expects "Parts outside any layer" and "Stories outside any capability"; then expects an opened layer row remembered in session storage only.
