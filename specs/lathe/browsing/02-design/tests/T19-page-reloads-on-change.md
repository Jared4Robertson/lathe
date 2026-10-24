---
id: LA-BRW-T19
kind: test
title: "An open spec page reloads the workspace on spec:changed"
parent: LA-BRW
test_type: component
run_by: app/test/reload.test.tsx
links:
  proves: [LA-BRW-UC05-R01]
---
Opens a record page, changes the served workspace, sends `spec:changed`, and checks that the page fetches the workspace again and shows the new title at the same address.
