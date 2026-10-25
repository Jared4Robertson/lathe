---
id: LA-BRW-C06
kind: component
title: Spec data and live reload
parent: LA-BRW-LAY01
component_type: module
file: app/src/specs/data.ts
links:
  reacts_to: [LA-MOD-EV03, LA-CHK-EV01, LA-CHK-EV02]
  satisfies: [LA-BRW-DR01, LA-BRW-DR03, LA-BRW-UC05-R01, LA-BRW-UC117-R07]
  depends_on: [LA-BRW-C01]
---
Fetches `GET /api/spec`, notes whether it came from the engine or the fixture, fetches it again on `spec:changed`, indexes the records and links both ways, and parses spec addresses into pages.
