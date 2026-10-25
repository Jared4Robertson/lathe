---
id: LA-PLT-T98
kind: test
title: "Accessibility: Tab reaches every control and comes back round, with no trap"
parent: LA-PLT
test_type: acceptance
run_by: app/a11y/keyboard.spec.ts
links:
  proves: [LA-PLT-UC10-R02, LA-PAT-APP-UX-R10]
---
On a record page with the wiki and the graph open, presses Tab until focus comes back to its first stop, and expects it to get there, every stop to be drawn, and Shift+Tab to go back the same way.
