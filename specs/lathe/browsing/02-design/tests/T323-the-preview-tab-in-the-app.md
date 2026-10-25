---
id: LA-BRW-T323
kind: test
title: A plain open replaces the italic preview tab, a double-click keeps it, a page already open activates its tab, and Back reopens a closed page as the preview
parent: LA-BRW
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-BRW-UC112-R01, LA-BRW-UC112-R02, LA-BRW-UC112-R07, LA-BRW-DR150, LA-BRW-DR153]
---
Opens a record and expects one preview tab with its ID in mono, labeling the tab panel; follows a wiki link and expects the preview replaced; double-clicks it to keep it and expects the next page in a new preview beside it, a group's tab with its label and no ID; follows a link to the kept page and expects its tab active, no second tab; clicks a tab and expects the address to follow; closes it, goes Back and expects it reopened as the preview.
