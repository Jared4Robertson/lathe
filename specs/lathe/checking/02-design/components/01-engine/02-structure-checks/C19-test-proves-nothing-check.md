---
id: LA-CHK-C19
kind: component
title: Test proves nothing check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/79-test-proves-nothing.sql
links:
  satisfies: [LA-CHK-UC04-R10, LA-CHK-DR28]
---
The `test-proves-nothing` warning: a test with no `proof` link (such as `proves`) and no `supports` link to a record that exists.
