---
id: LA-EXP-C57
kind: component
title: Domain event lookups
parent: LA-EXP-LAY04
component_type: module
file: app/src/model/events.ts
links:
  satisfies: [LA-EXP-UC11-R07, LA-EXP-UC11-R08, LA-TRC-UC14-R06, LA-EXP-DR51]
---
Pure lookups over the index for domain events, shared by the ERD and the aggregate's wiki page: an aggregate's events, the aggregate an event sits under, an event's `raised_by` links to entities, every `reacts_to` link to it, the aggregates reacting to it and the events an aggregate reacts to, each in ID order.
