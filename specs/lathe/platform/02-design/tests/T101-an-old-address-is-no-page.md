---
id: LA-PLT-T101
kind: test
title: "An old address is no page: /records, /specs and /graph addresses say so, and the address stays as typed"
parent: LA-PLT
test_type: acceptance
run_by: app/test/standards.test.tsx
links:
  proves: [LA-EXP-UC05-R01, LA-EXP-DR10, LA-PAT-APP-CODE-R20]
  covers: [LA-EXP-C13, LA-EXP-C54, LA-PLT-C11]
---
Opens `/records/<id>`, `/records/<parent>/<kind>`, `/specs`, `/specs/<product>/<domain>`, `/graph` and `/graph/<id>`, and expects each to read as a missing page, to say there is no such page, and to keep its address. Then opens a record with `?view=split` and expects no Graph pane, as `split` names no view.
