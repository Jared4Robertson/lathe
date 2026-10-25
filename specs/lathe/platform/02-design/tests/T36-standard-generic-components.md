---
id: LA-PLT-T36
kind: test
title: "Generic components know nothing of specs, the graph or the shell: they import only React and each other"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R04]
---
Reads every file in `app/src/components` and expects imports only from React, React DOM and the same folder.
