---
id: LA-PLT-T135
kind: test
title: "In the Tree and Nested layouts, at every domain, stage and folder of every product, at depths 1 to 3 in two panes, every drawn box shows its name"
parent: LA-PLT
test_type: unit
run_by: app/test/graph/readable.test.ts
links:
  proves: [LA-PAT-APP-UX-R12]
---
Loads the repo's own specs (Lathe and the Tool Library), and for each layout and product frames every domain, stage and folder group at depths 1, 2 and 3 in a 770 by 640 and a 1200 by 800 pane with the real camera; expects every drawn box's label lines to give back its title and its kind and ID line, and the label to fit its box at its scale. On a failure it names the layout, focus, depth, pane, box and its size on screen.
