---
id: LA-BRW-T446
kind: test
title: "Without the engine's reference the pages are built from the loaded specs, and say what is missing"
parent: LA-BRW
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-BRW-DR210]
---
With no answer from `GET /api/format`, expects the format page to list the checks that report problems and say their explanations are missing, and a check's page to show its problems.
