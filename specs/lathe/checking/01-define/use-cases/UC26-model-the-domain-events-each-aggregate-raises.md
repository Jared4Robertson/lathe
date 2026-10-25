---
id: LA-CHK-UC26
kind: use_case
title: Model the domain events each aggregate raises
parent: LA-CHK-CAP03
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR198, LA-CHK-DR199, LA-CHK-DR200, LA-CHK-DR201, LA-CHK-DR202]
---
Jared, or an agent, writes what happens in each aggregate as domain events: each under the aggregate that raises it, named in the past tense, with a Fields table of what it carries and, when an entity's change raises it, `raised_by` that entity. The records that react link to it with `reacts_to`. `lathe check` reports an event raised from another aggregate, an event that nothing reacts to and a title that does not read as past tense.
