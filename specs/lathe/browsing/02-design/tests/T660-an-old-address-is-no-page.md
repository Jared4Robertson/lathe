---
id: LA-BRW-T660
kind: test
title: "An old address is no page: /records, /specs and /graph addresses say so, and the address stays as typed"
parent: LA-BRW
test_type: acceptance
run_by: app/test/standards.test.tsx
links:
  proves: [LA-BRW-UC50-R01, LA-BRW-DR52, LA-PAT-APP-CODE-R20]
  covers: [LA-BRW-C50, LA-BRW-C270, LA-BRW-C62]
---
Opens `/records/<id>`, `/records/<parent>/<kind>`, `/specs`, `/specs/<product>/<domain>`, `/graph` and `/graph/<id>`, and expects each to read as a missing page, to say there is no such page, and to keep its address. Then opens a record with `?view=split` and expects no Graph pane, as `split` names no view.
