---
id: LA-PLT-T21
kind: test
title: The shortcuts sheet and the command palette are searchable, and the palette runs commands
parent: LA-PLT
test_type: acceptance
run_by: app/test/shortcuts.test.tsx
links:
  proves: [LA-PLT-UC03-R04, LA-PLT-UC03-R05]
---
Opens the sheet with ?, expects its groups, a shortcut, the override note and the search; expects ? typed into a search box; opens the palette, filters to Graph view on or off, runs it, and finds Expand all and Collapse all.
