---
id: LA-CHK-T49
kind: test
title: A component that satisfies nothing is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/purpose.test.ts
links:
  proves: [LA-CHK-UC04-R09]
---
Loads components that satisfy a requirement, only implement a view and depend on another component, or satisfy a record that does not exist, and expects the warning on the last two only.
