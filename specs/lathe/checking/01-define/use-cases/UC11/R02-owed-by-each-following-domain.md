---
id: LA-CHK-UC11-R02
kind: requirement
title: Each domain that follows a pattern owes its rules
parent: LA-CHK-UC11
---
Coverage MUST count each pattern rule once in each domain that follows its pattern, meaning one of the domain's use cases `follows` the pattern, on that domain's `pattern_rule` line. A domain that does not follow the pattern MUST NOT count the rule, and the rule's gaps MUST name it in each domain that owes it.
