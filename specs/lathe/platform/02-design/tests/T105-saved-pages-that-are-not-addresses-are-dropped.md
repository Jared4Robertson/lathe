---
id: LA-PLT-T105
kind: test
title: Tabs and space pages saved at anything but a page's address are dropped, not converted
parent: LA-PLT
test_type: component
run_by: app/test/addresses.test.tsx
links:
  proves: [LA-EXP-UC10-R06, LA-PAT-APP-CODE-R20]
  covers: [LA-EXP-C44, LA-EXP-C13]
---
Saves a tab set with two tabs at bare IDs and two under `/records` and `/specs`, and a space's last page under `/specs`, opens the app, and expects only the two tabs at bare IDs, written back that way, and the space's rail link at its product.
