---
id: LA-PLT-T96
kind: test
title: The first load reaches no React Flow and no ELK through static imports
parent: LA-PLT
test_type: unit
run_by: app/test/first-load-imports.test.ts
links:
  proves: [LA-PAT-APP-UX-R11]
---
Walks the static imports from `app/src/main.tsx` through the app's own modules and expects none to import `@xyflow/react` (its stylesheet aside) or `elkjs`, naming the file, line and import path of any that does, so the first-load budget is guarded without a browser.
