---
id: LA-PLT-C07
kind: component
title: Spec data and live reload
parent: LA-PLT-LAY06
component_type: module
file: app/src/specs/data.ts
links:
  reacts_to: [LA-AUT-EV01, LA-AUT-EV03, LA-CHK-EV01]
  satisfies: [LA-EXP-DR01, LA-EXP-DR02, LA-PLT-UC02-R01, LA-PLT-UC08-R07]
  depends_on: [LA-PLT-C04]
---
Fetches `GET /api/spec`, notes whether it came from the engine or the fixture, fetches it again on `spec:changed`, indexes the records and links both ways, and parses spec addresses into pages.
