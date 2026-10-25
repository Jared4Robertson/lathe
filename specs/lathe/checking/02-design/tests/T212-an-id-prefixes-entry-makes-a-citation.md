---
id: LA-CHK-T212
kind: test
title: A token starting with an idPrefixes entry and "-" is a citation
parent: LA-CHK
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-CHK-UC18-R02, LA-CHK-UC18-R05, LA-CHK-DR121]
---
Expects the configured prefixes to be loaded, missing IDs with them to be unknown-ID warnings, and the same tokens to be ignored in a workspace without them.
