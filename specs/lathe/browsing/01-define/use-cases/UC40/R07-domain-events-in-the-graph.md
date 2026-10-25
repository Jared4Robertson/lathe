---
id: LA-BRW-UC40-R07
kind: requirement
title: Domain events sit under their aggregate, and their links are dashed and labeled
parent: LA-BRW-UC40
---
In the graph, an aggregate's domain events MUST sit under it through a "Domain events" group, by the one-kind rule, and each event MUST be drawn as a pill in the spark colors. With the Links switch on, an event's `reacts_to` and `raised_by` links MUST be drawn dashed in spark and labeled with their relations' labels ("Reacts to", "Raised by"); with it off they are not drawn.
