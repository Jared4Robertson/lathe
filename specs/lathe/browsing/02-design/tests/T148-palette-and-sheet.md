---
id: LA-BRW-T148
kind: test
title: The shortcuts sheet and the command palette are searchable, and the palette runs commands
parent: LA-BRW
test_type: acceptance
run_by: app/test/shortcuts.test.tsx
links:
  proves: [LA-BRW-UC51-R04, LA-BRW-UC51-R05]
---
Opens the sheet with ?, expects its groups, a shortcut, the override note and the search; expects ? typed into a search box; opens the palette, filters to Toggle Split view, runs it, and finds Expand all and Collapse all.
