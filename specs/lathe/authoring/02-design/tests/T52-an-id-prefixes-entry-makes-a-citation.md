---
id: LA-AUT-T52
kind: test
title: A token starting with an idPrefixes entry and "-" is a citation
parent: LA-AUT
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-AUT-UC08-R02, LA-AUT-UC08-R05, LA-AUT-DR28]
---
Expects the configured prefixes to be loaded, missing IDs with them to be unknown-ID warnings, and the same tokens to be ignored in a workspace without them.
