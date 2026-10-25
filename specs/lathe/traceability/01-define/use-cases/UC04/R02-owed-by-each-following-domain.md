---
id: LA-TRC-UC04-R02
kind: requirement
title: Each domain that follows a pattern owes its rules
parent: LA-TRC-UC04
---
Coverage MUST count each pattern rule once in each domain that follows its pattern, meaning the domain itself or one of its use cases `follows` the pattern, on that domain's `pattern_rule` line. A domain that does not follow the pattern MUST NOT count the rule, and the rule's gaps MUST name it in each domain that owes it.
