---
id: LA-AUT-T22
kind: test
title: The server has no way to change the meta-model
parent: LA-AUT
test_type: domain_rule
run_by: lathe/test/serve.test.ts
links:
  proves: [LA-AUT-DR11]
---
Sends POST and PUT requests to `/api/spec` and to meta-model paths on the running server, and expects them refused with the meta-model files unchanged.
