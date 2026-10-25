---
id: LA-BRW-T298
kind: test
title: The page bar holds the page's tabs and layout controls; each pane's header holds only that pane's actions, on wide and narrow screens
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R03, LA-BRW-UC50-R02]
---
Opens a record alone, with the wiki and graph, and with both on a phone. Expects one page bar, outside every pane and the inspector, holding the tab strip at its left (on a phone, the Open pages button instead), and at its right the one "View" group of `aria-pressed` toggles, one pressed per shown pane, with the inspector toggle last. On a wide screen each pane is a panel whose first child is its slim header: a non-interactive label naming its view, and only its close button (when more than one pane is open) and its full screen button, all icon buttons, with no tabs or groups in it. On a phone one pane shows, with no header. The title sits in the leftmost pane, and the stylesheet gives the page bar and the pane headers fixed heights.
