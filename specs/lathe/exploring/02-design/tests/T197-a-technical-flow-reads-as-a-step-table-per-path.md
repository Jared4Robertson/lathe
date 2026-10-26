---
id: LA-EXP-T197
kind: test
title: A technical flow reads as a step table per path, with each step's component and what it satisfies
parent: LA-EXP
test_type: acceptance
run_by: app/test/apis-and-design-flows.test.tsx
links:
  proves: [LA-EXP-UC06-R07]
---
Renders a technical flow with two main steps and a refused one and expects a table per path with the columns Step, What happens, Component and Satisfies, the linked IDs in each, and the step's transaction, locks and statements folded under its row.
