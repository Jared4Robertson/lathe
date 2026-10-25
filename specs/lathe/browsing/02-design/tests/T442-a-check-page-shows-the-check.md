---
id: LA-BRW-T442
kind: test
title: "A check page shows its severity, explanation and source file, and its problems now as clickable rows"
parent: LA-BRW
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-BRW-UC115-R03, LA-BRW-DR211]
---
Opens a check's page and expects its summary, rendered explanation, source file and its problems as clickable rows, with the side bar's facts; a check that reports nothing says so, and an unknown check or kind says it is not in the format.
