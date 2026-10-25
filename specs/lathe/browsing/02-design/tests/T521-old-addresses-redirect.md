---
id: LA-BRW-T521
kind: test
title: Old addresses redirect to the same thing at its ID, replacing the history entry and keeping the query and hash
parent: LA-BRW
test_type: acceptance
run_by: app/test/standards.test.tsx
links:
  proves: [LA-BRW-DR281, LA-BRW-UC50-R01]
  covers: [LA-BRW-C50, LA-BRW-C270]
---
Maps each old address to its new one in a table: `/records/<id>`, `/records/<parent>/<kind>` and a test-plan group, `/specs`, `/specs/<product>`, `/specs/<product>/<domain>`, its `/graph`, `/graph/<id>`, `/graph/<parent>/<kind>` and `/graph` alone. Expects today's addresses to be left alone, and a redirect to keep the query and hash. Then opens `/records/<id>?view=wiki#…`, `/specs/<product>/<domain>` and `/specs` and expects the new address with the query and hash, no new history entry, and the page.
