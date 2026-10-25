---
id: LA-BRW-T120
kind: test
title: A record and a group each have one address, and old graph addresses lead there
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R01, LA-BRW-DR50]
---
Parses record and group addresses at their bare IDs, builds the address of a record, a group and a domain, then opens `/graph/<id>` and `/specs/<p>/<d>/graph` and expects the same thing at its ID in the Graph view, and a group page at its own address.
