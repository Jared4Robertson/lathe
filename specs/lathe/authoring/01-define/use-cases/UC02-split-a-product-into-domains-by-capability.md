---
id: LA-AUT-UC02
kind: use_case
title: Split a product into domains by capability
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-AUT-DR71]
---
The owner, or an agent, decides a product's domains before writing its records. Lathe's record format and its modeling skill steer each domain toward one business capability, a vertical slice that owns its records, rules, views, code and tests, and away from technology layers such as the web app or the server. `lathe check` warns of a domain named for a technology.
