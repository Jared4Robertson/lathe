---
id: LA-PLT-T59
kind: test
title: A phone shows a compact top bar with the title and a step up, and one view at a time switched from the page bar, leaving the views remembered for a wide screen alone
parent: LA-PLT
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC07-R01, LA-PLT-UC07-R02, LA-PLT-DR16]
---
On a phone, opens a record with `?view=wiki,graph` and expects the top bar's menu, title, link up to the domain (keeping the views) and quick find; the wiki alone with no pane headers or handles; then switches to the graph and expects `?view=graph`, the graph alone, and the remembered views unchanged. A domain's link goes up to its product.
