---
id: LA-BRW-T171
kind: test
title: IDs in code blocks, code with other text, links and longer IDs are not linked; a lone-ID code span is
parent: LA-BRW
test_type: unit
run_by: app/test/mentions.test.tsx
links:
  proves: [LA-BRW-UC60-R06, LA-BRW-DR73]
---
Expects no links for IDs in code blocks, code spans with other text, links or longer IDs, a link around a code span holding one lone ID, and HTML left unchanged when there is nothing to link.
