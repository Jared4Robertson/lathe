---
id: LA-PLT-T104
kind: test
title: "Changes are hard cutovers: no redirect, alias, legacy path or second addressOf signature in the app or the engine"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R20]
  covers: [LA-EXP-C13]
---
Reads every source file in `app/src` and `lathe/src` and expects no line that says legacy, redirect or alias, naming the file and line of each, and exactly one declaration of `addressOf`, taking the ID alone.
