---
id: LA-BRW-T298
kind: test
title: Each pane has one title bar naming its view and holding the view toggles and layout actions as icon buttons, and nothing else switches views
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record alone and in a split and expects each pane to be a panel whose first child is its title bar, with a non-interactive label naming its view at the left and only icon buttons in its actions; no tabs; one "View" group of `aria-pressed` icon buttons inside the actions on a single pane, none in a split; every view toggle, the open beside and close buttons, the full screen buttons and the page's inspector toggle inside a title bar, and the page title inside a pane.
