---
id: LA-CHK-UC11
kind: use_case
title: Prove the rules of the patterns a domain follows
parent: LA-CHK-CAP02
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR50, LA-CHK-DR51, LA-CHK-DR52, LA-CHK-DR53, LA-CHK-DR54]
---
A pattern states behaviour that several use cases share. Its rules are written once, as `pattern_rule` records under the pattern, instead of in its body. Every domain that follows the pattern (one of its use cases `follows` it) must design and prove each rule in its own components and tests, as S2's "Patterns we follow" tables do: proof in one domain says nothing about another. A rule that depends on a setting names it, and a domain whose following use cases all mark that setting `Not applicable:` with a reason does not owe the rule.

The person writes the rules under the pattern, links each following domain's components to them with `satisfies` and its tests with `proves`, and runs `lathe check`. Coverage shows one Pattern rule line per domain; the gaps and the `unsatisfied` and `unproved` warnings name the rule and the domain that still owes it. A pattern nobody follows, a rule naming a setting its pattern does not have, and any other obligation that sits in no domain are reported.
