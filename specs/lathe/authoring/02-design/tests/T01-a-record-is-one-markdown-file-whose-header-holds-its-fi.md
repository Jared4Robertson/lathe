---
id: LA-AUT-T01
kind: test
title: A record is one Markdown file whose header holds its fields and links
parent: LA-AUT
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-AUT-UC01-R01]
---
Loads a clean record workspace and expects each record's header fields, links and body to come from its one file, with no problems.
