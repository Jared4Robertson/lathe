---
id: LA-PLT-T86
kind: test
title: Outline lists the wiki's sections, scrolls to one and marks it, and lists the Model view's boxes
parent: LA-PLT
test_type: acceptance
run_by: app/test/side-bar.test.tsx
links:
  proves: [LA-EXP-UC12-R04, LA-PAT-APP-UX-R05]
---
Expects the wiki's Traceability and Problems sections among the outline's rows, a click to scroll the wiki pane and mark that row `aria-current="location"`, and a domain's Model view outline to list its aggregates as whole-row links.
