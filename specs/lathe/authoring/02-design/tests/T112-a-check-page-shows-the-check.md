---
id: LA-AUT-T112
kind: test
title: A check page shows its severity, explanation and source file, and its problems now as clickable rows
parent: LA-AUT
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-AUT-UC14-R03, LA-AUT-DR74]
---
Opens a check's page and expects its summary, rendered explanation, source file and its problems as clickable rows, with the side bar's facts; a check that reports nothing says so, and an unknown check or kind says it is not in the format.
