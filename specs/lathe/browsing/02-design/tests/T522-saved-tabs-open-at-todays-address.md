---
id: LA-BRW-T522
kind: test
title: Tabs and space pages saved under old addresses open at today's
parent: LA-BRW
test_type: component
run_by: app/test/addresses.test.tsx
links:
  proves: [LA-BRW-DR281, LA-BRW-UC112-R06]
  covers: [LA-BRW-C271]
---
Saves a tab set with `/records/<id>`, `/specs/<product>/<domain>` and `/records/<parent>/<kind>` tabs and a space's last page at `/specs/<product>/<domain>?view=graph`, opens the app, and expects the tabs at the bare IDs, written back that way, and the space's rail link at the domain's ID with its view.
