---
id: LA-TRC-UC04
kind: use_case
title: Prove the rules of the patterns a domain follows
parent: LA-TRC-CAP01
actor: Owner, Agent
links:
  applies: [LA-TRC-DR07, LA-TRC-DR08, LA-TRC-DR09, LA-TRC-DR10, LA-AUT-DR18]
---
A pattern states behavior that several use cases share. Its rules are written once, as `pattern_rule` records under the pattern, instead of in its body. Every domain that follows the pattern (the domain itself or one of its use cases `follows` it) must prove each rule in its own tests, as S2's "Patterns we follow" tables do: proof in one domain says nothing about another. Pattern rules need proof only by default; a product that sets `pattern_rule` to `obligation: yes` asks for each rule's design in the domain's own components too. A rule that depends on a setting names it, and a domain that follows only through use cases that all mark that setting `Not applicable:` with a reason does not owe the rule.

The person writes the rules under the pattern, links each following domain's tests to them with `proves` (and its components with `satisfies`, where design is asked or wanted), and runs `lathe check`. Coverage shows one Pattern rule line per domain; the gaps and the `unproved` (and, where design is asked, `unsatisfied`) warnings name the rule and the domain that still owes it. A pattern nobody follows, a rule naming a setting its pattern does not have, and any other obligation that sits in no domain are reported.
