---
id: LA-CHK-C181
kind: component
title: Check header reader
parent: LA-CHK-LAY12
component_type: module
file: lathe/src/reference.ts
links:
  satisfies: [LA-CHK-DR190, LA-CHK-DR191, LA-CHK-DR193]
---
`parseCheckHeader` reads a check file's leading comment lines: the first paragraph is the summary, the rest the explanation as Markdown, and the `severity:` and `kinds:` lines its fields. It says what the header lacks, and the workspace loader puts each header in the `check_docs` table for the undocumented check.
