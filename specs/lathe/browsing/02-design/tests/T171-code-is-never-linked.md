---
id: LA-BRW-T171
kind: test
title: IDs in code, links and longer IDs are not linked
parent: LA-BRW
test_type: unit
run_by: app/test/mentions.test.tsx
links:
  proves: [LA-BRW-UC60-R06, LA-BRW-DR73]
---
Expects no links for IDs in code spans, code blocks, links or longer IDs, and HTML left unchanged when there is nothing to link.
