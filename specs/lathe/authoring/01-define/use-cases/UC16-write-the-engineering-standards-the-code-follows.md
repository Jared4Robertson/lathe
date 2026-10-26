---
id: LA-AUT-UC16
kind: use_case
title: Write the engineering standards the code follows
parent: LA-AUT-CAP03
actor: Owner, Agent
links:
  applies: [LA-AUT-DR76, LA-AUT-DR77]
---
The owner, or an agent, writes the rules the product's code follows, such as logging, error handling or naming, as a standard under the product with a `standard_rule` record for each rule. Each component or test that follows a rule links to it with `meets`, or cites its ID. A standard rule owes no coverage; `lathe check` warns of a rule that nothing meets or cites. A rule proved by tests stays a pattern rule: a rule you prove with tests is a pattern rule, and a rule you follow and cite is a standard rule. A reader finds the standards under Shared, beside the patterns.
