---
id: LA-AUT-UC13
kind: use_case
title: Model the domain events each aggregate raises
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-AUT-DR63, LA-AUT-DR64, LA-AUT-DR65, LA-AUT-DR66, LA-AUT-DR67]
---
The owner, or an agent, writes what happens in each aggregate as domain events: each under the aggregate that raises it, named in the past tense, with a Fields table of what it carries and, when an entity's change raises it, `raised_by` that entity. The records that react link to it with `reacts_to`. `lathe check` reports an event raised from another aggregate, an event that nothing reacts to and a title that does not read as past tense.
