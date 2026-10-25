---
id: LA-EXP-T12
kind: test
title: Spec pages offer no way to change a record and only read GET /api/spec
parent: LA-EXP
test_type: component
run_by: app/test/read-only.test.tsx
links:
  proves: [LA-EXP-DR03]
---
Opens every spec page and checks that it has no form, button or editable field other than the search box, and that using it makes no request other than reading the workspace and the record format.
