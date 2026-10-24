---
id: LA-MOD-F03
kind: flow
title: Write a spec record and check it
parent: LA-MOD
links:
  fulfills: [LA-MOD-UC03-R01, LA-MOD-UC03-R04]
  carries_out: [LA-MOD-UC03]
---
1. An agent, or Jared, writes a Markdown file under `specs/` with its YAML header (`id`, `kind`, `title`, `parent`, kind fields and `links`) and its body. A component names its `file` and a test its `run_by`.
2. They run `lathe check`, which reports each problem with the record it belongs to.
3. They fix the record until the check has no errors, and the change is reviewed in git like code.
