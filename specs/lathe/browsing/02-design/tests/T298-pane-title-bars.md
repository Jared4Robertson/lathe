---
id: LA-BRW-T298
kind: test
title: Each pane has one title bar, the leftmost holding the tabs and the others naming their view, the View toggles once on the rightmost, all icon buttons, on wide and narrow screens
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record alone, with the wiki and graph, and with both on a narrow screen, and expects each pane to be a panel whose first child is its title bar, the leftmost with the one tab strip at its left (every tab inside a title bar) and the others with a non-interactive label naming their view, and only icon buttons in its actions; one "View" group of `aria-pressed` icon buttons, in the rightmost pane's actions, with one pressed toggle per open pane; every view toggle, close and full screen button and the page's inspector toggle inside a title bar, on the narrow screen too, with no row of layout controls of its own (`pane-narrow-actions`), and the page title inside a pane.
