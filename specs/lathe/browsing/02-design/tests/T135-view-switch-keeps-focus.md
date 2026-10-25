---
id: LA-BRW-T135
kind: test
title: Switching views by keyboard keeps focus, and the toggles show a focus ring
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R02]
---
Focuses a button in the graph pane, closes the graph with Ctrl+2 and expects focus on the Graph toggle, now in the wiki pane's bar; checks the toggle tooltips (Alt+G off a Mac) and the focus ring style.
