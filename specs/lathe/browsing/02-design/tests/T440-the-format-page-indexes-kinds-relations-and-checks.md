---
id: LA-BRW-T440
kind: test
title: "The format page shows the concepts, then the kinds by stage and folder, the relations and the checks by severity, as clickable rows"
parent: LA-BRW
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-BRW-UC115-R01, LA-BRW-UC115-R04]
---
Opens `/format` and expects the title in the pane, the inspector's counts, the fitness section's anchor, a kind row under Define, Capabilities leading to its page, the relations by their words, and the checks under Errors and Warnings leading to their pages.
