---
id: LA-AUT-T57
kind: test
title: The token reader tells an ID in a lone code span from one in prose
parent: LA-AUT
test_type: unit
run_by: lathe/test/citations-by-id.test.ts
links:
  proves: [LA-AUT-UC08-R03, LA-AUT-DR29]
---
Expects `proseTokens` to mark IDs from lone-ID code spans, with and without a hyphen, and not those in prose, and to drop a code span with other text.
