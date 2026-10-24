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
Focuses a button in the graph pane, switches to Wiki with Ctrl+1 and expects focus on the Wiki toggle; checks the toggle tooltips and the focus ring style.
