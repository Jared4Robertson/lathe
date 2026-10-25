---
id: LA-CHK-T333
kind: test
title: A flow's steps are counted per path, and the message names a path other than main
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R05]
---
Loads a flow with three steps on main and three on refused under a limit of 3, and expects no warning; then a flow with four steps on refused, and expects one warning naming that path.
