---
id: LA-PLT-T64
kind: test
title: The open pages are a sheet from the page bar
parent: LA-PLT
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC08-R05, LA-PLT-DR17]
---
On a phone, opens the Open pages sheet, keeps the preview tab from its row, opens another page, and expects two rows with the active one marked and focused; choosing a row goes there and closes the sheet; a row's close button closes its tab.
