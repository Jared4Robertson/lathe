---
id: LA-TRC-UC07
kind: use_case
title: Follow a pattern per domain, with or without settings
parent: LA-TRC-CAP01
actor: Owner, Agent
links:
  applies: [LA-TRC-DR19, LA-TRC-DR20, LA-TRC-DR21, LA-AUT-DR32, LA-AUT-DR33, LA-TRC-DR22, LA-AUT-DR34, LA-TRC-DR23, LA-AUT-DR35]
---
A real product adopts most of its patterns for a whole domain, writes several with no settings, and asks only for proof of their rules. The owner, or an agent, links a domain to a pattern with `follows` and leaves `settings` out where a pattern has none. Coverage then counts each rule in that domain, as it does for a domain whose use cases follow the pattern, and asks only for proof: a pattern rule needs no component, since a real product often builds it through shared helpers. A use case that follows a pattern needs no requirements of its own, and interaction requirements and flow steps may fulfill pattern rules directly, with `flow-step-fulfills-outside-flow` treating the rules of the patterns a flow's use cases or domain follow as inside the flow. A product that wants pattern rules designed too sets `pattern_rule` back to `obligation: yes` in its extension, and any kind may be made proof-only with `obligation: proof`.
