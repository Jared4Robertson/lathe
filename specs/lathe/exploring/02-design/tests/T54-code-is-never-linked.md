---
id: LA-EXP-T54
kind: test
title: IDs in code blocks, code with other text, links and longer IDs are not linked; a lone-ID code span is
parent: LA-EXP
test_type: unit
run_by: app/test/mentions.test.tsx
links:
  proves: [LA-EXP-UC02-R06, LA-EXP-V03-R05]
---
Expects no links for IDs in code blocks, code spans with other text, links or longer IDs, a link around a code span holding one lone ID, and HTML left unchanged when there is nothing to link.
