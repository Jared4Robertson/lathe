---
id: LA-BRW-T468
kind: test
title: "Everything works by touch: on a coarse pointer every clickable control is at least 44 × 44 px"
parent: LA-BRW
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R07, LA-BRW-UC116-R10, LA-BRW-UC116-R03]
---
Reads `app/src/styles.css` and expects every rule with a pointer cursor to be covered by a coarse-pointer rule that sizes the control (or a `::before` stretched around it) to `--touch-target` (44 px), or to be touch-sized everywhere; canvas nodes and cards are exempt, being laid out large and zoomable.
