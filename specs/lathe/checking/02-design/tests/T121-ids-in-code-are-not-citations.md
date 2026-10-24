---
id: LA-CHK-T121
kind: test
title: "IDs in code spans and fenced code blocks are not citations"
parent: LA-CHK
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC13-R02]
---
Expects IDs in single and double backtick spans, a backtick fence and a tilde fence (holding a shorter fence of the other character) to be neither mentions nor warnings, and a fence left open to hide the rest of the body.
