---
id: LA-PLT-T82
kind: test
title: "One address per thing: only address.ts makes a record or group address, and every address is an ID or a lowercase app page"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R19, LA-EXP-DR08]
  covers: [LA-EXP-C13, LA-EXP-C54]
---
Reads every source file in `app/src` and `desktop/src` except `address.ts` and expects no path built by hand under `/records`, `/specs` or `/graph`, nor a template starting `/${…}`. Expects every app page's first word to be lowercase and never an ID, `/` to be the products, an ID to be a product, domain or record page and an ID with a kind a group. Then renders the products, a product, a domain, a record, a group, Checks, the format and Appearance, and expects every in-app link to be `/`, an app page or an ID.
