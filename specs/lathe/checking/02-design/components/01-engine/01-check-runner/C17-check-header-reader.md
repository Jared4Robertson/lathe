---
id: LA-CHK-C17
kind: component
title: Check header reader
parent: LA-CHK-LAY02
component_type: module
file: lathe/src/reference.ts
links:
  satisfies: [LA-CHK-DR24, LA-CHK-DR25, LA-CHK-DR26]
---
`parseCheckHeader` reads a check file's leading comment lines: the first paragraph is the summary, the rest the explanation as Markdown, and the `severity:` and `kinds:` lines its fields. It says what the header lacks, and the workspace loader puts each header in the `check_docs` table for the undocumented check.
