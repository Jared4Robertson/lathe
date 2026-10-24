---
id: LA-CHK-T28
kind: test
title: The server has no way to change the meta-model
parent: LA-CHK
test_type: acceptance
run_by: lathe/test/serve.test.ts
links:
  proves: [LA-CHK-DR10]
---
Sends POST and PUT requests to `/api/spec` and to meta-model paths on the running server, and expects them refused with the meta-model files unchanged.
