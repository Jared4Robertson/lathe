---
id: LA-MOD-T23
kind: test
title: A record is one Markdown file whose header holds its fields and links
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC03-R01]
---
Loads a clean record workspace and expects each record's header fields, links and body to come from its one file, with no problems.
