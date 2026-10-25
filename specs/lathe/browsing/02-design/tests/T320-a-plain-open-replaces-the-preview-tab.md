---
id: LA-BRW-T320
kind: test
title: A plain open replaces the one preview tab in place, a page open in a tab activates it, and keeping makes a tab lasting
parent: LA-BRW
test_type: unit
run_by: app/test/tabs.test.ts
links:
  proves: [LA-BRW-DR150, LA-BRW-UC112-R01]
---
Opens pages in an empty tab set and expects each plain open to replace the preview tab where it sits, keeping its key, with its state made from the tab that was active; a kept tab to stay when the next page opens beside it; a page already open to activate its tab; a kept open to add a lasting tab after the active one; and never two previews or two tabs for one page.
