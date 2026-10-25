---
id: LA-PLT-T106
kind: test
title: In development the window uses the 5199 server only when it answers for the opened folder
parent: LA-PLT
test_type: unit
run_by: desktop/test/devSource.test.ts
links:
  proves: [LA-PLT-DR33, LA-PLT-DR34, LA-PLT-UC11-R01]
---
Chooses the development source against a fake 5199 that answers for the folder, for another folder, without the header, with an error, or not at all; and checks that a free port is never 5199 or a port in use.
