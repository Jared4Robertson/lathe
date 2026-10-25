---
id: LA-BRW-T523
kind: test
title: A product's and a domain's one page shows its body, facts, links both ways and problems
parent: LA-BRW
test_type: component
run_by: app/test/addresses.test.tsx
links:
  proves: [LA-BRW-DR280, LA-BRW-UC50-R06]
  covers: [LA-BRW-C270]
---
Opens a product and a domain at their IDs and expects the body in the wiki, the parent, spec file, links out, links in and problems in the side bar, and no link to a second overview page.
