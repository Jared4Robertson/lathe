---
id: LA-CHK-T211
kind: test
title: "A token starting with a product's or domain's ID and '-' is a citation"
parent: LA-CHK
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-CHK-UC18-R02, LA-CHK-DR121]
---
Expects a domain rule cited with the domain's prefix to be mentioned, and a missing ID with the domain's prefix to be one unknown-ID warning.
