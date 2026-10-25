---
id: LA-BRW-T298
kind: test
title: Each pane has one title bar naming its view, the View toggles once on the rightmost, all icon buttons, and nothing else switches views
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record alone and with the wiki and graph and expects each pane to be a panel whose first child is its title bar, with a non-interactive label naming its view at the left and only icon buttons in its actions; no tabs; one "View" group of `aria-pressed` icon buttons, in the rightmost pane's actions, with one pressed toggle per open pane; every view toggle, close and full screen button and the page's inspector toggle inside a title bar, and the page title inside a pane.
