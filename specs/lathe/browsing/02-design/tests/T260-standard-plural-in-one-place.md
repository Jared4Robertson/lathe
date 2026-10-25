---
id: LA-BRW-T260
kind: test
title: "Kind labels become plural only through plural(): no template adds an \"s\" to a label"
parent: LA-BRW
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R05]
---
Reads the app's source, apart from `plural.ts`, and expects no template or sum that adds an "s" to a label.
