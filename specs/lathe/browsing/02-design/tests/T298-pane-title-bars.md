---
id: LA-BRW-T298
kind: test
title: Each pane has one title bar holding its tabs and layout actions, and nothing else switches views
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record alone and in a split and expects each pane to be a panel whose first child is its title bar, every view tab, the open beside and close buttons, the full screen buttons and the page's inspector toggle inside a title bar, and the page title inside a pane.
