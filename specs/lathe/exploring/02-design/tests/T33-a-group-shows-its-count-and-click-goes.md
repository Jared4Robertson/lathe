---
id: LA-EXP-T33
kind: test
title: A group shows its name and count, with no chevron; clicking a group, or Enter on it, goes to it
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R01, LA-EXP-UC04-R02]
---
Opens a domain's graph and expects the open questions' group drawn as a folder with no chevron and no button; clicks the group and expects its address, the group the center, and its name and count in its tooltip; goes back and presses Enter on a stage and expects its address.
