---
id: LA-PLT-T35
kind: test
title: Kind labels become plural only through plural() and lowercase only through lowerLabel()
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R05]
---
Reads the app's source, apart from `plural.ts`, and expects no template or sum that adds an "s" to a label. It also expects no label lowercased by hand with `toLowerCase()`.
