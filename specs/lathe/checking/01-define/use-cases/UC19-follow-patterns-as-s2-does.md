---
id: LA-CHK-UC19
kind: use_case
title: "Follow patterns as S2 does: per domain, with or without settings, proved only"
parent: LA-CHK-CAP03
actor: Owner, Agent
links:
  applies: [LA-CHK-DR130, LA-CHK-DR131, LA-CHK-DR132, LA-CHK-DR133, LA-CHK-DR134, LA-CHK-DR135, LA-CHK-DR136, LA-CHK-DR137, LA-CHK-DR138]
---
S2 adopts most of its patterns for a whole domain, writes several with no settings, and asks only for proof of their rules. The owner, or an agent, links a domain to a pattern with `follows` and leaves `settings` out where a pattern has none. Coverage then counts each rule in that domain, as it does for a domain whose use cases follow the pattern, and asks only for proof: a pattern rule needs no component, since S2 builds it through shared helpers. A use case that follows a pattern needs no requirements of its own, and interaction requirements and flow steps may fulfill pattern rules directly, with `flow-step-fulfills-outside-flow` treating the rules of the patterns a flow's use cases or domain follow as inside the flow. A product that wants pattern rules designed too sets `pattern_rule` back to `obligation: yes` in its extension, and any kind may be made proof-only with `obligation: proof`.
