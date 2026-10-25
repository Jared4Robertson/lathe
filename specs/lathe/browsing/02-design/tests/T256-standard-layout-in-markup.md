---
id: LA-BRW-T256
kind: test
title: "Layout lives in the markup: no stylesheet rule moves or restyles an element from outside its component"
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R01]
---
Reads `app/src/styles.css` and expects no `display: contents` and no `:has()`. Then opens a record page and expects its Children section's Expand all inside the section's own header row.
