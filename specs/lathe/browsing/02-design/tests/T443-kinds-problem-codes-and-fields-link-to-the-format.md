---
id: LA-BRW-T443
kind: test
title: "The inspector's kind, each problem code and each required field label link to their format pages"
parent: LA-BRW
test_type: component
run_by: app/test/format-pages.test.tsx
links:
  proves: [LA-BRW-UC115-R05, LA-BRW-DR212]
---
On a record page expects the Kind row and the `actor` label to link to the kind's page; on a record page, a domain page and the Checks page expects each problem code to link to its check's page; on a group page expects the kind to link too.
