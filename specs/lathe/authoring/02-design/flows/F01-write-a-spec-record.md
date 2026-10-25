---
id: LA-AUT-F01
kind: flow
title: Write a spec record and check it
parent: LA-AUT
links:
  fulfills: [LA-AUT-UC01-R01, LA-AUT-UC01-R04]
  carries_out: [LA-AUT-UC01]
---
1. An agent, or the owner, writes a Markdown file under `specs/` with its YAML header (`id`, `kind`, `title`, `parent`, kind fields and `links`) and its body. A component names its `file` and a test its `run_by`.
2. They run `lathe check`, which reports each problem with the record it belongs to.
3. They fix the record until the check has no errors, and the change is reviewed in git like code.
