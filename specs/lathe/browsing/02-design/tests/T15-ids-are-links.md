---
id: LA-BRW-T15
kind: test
title: "Every record ID a page shows is a real link to that record"
parent: LA-BRW
test_type: component
run_by: app/test/links.test.tsx
links:
  proves: [LA-BRW-DR02]
---
Opens every product, domain, record and checks page of the fixture and checks that each record ID shown sits in an `<a href>` to that record's page.
