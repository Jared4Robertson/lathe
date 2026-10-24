---
id: LA-CHK-UC11-R04
kind: requirement
title: A pattern rule does not apply where its setting is Not applicable
parent: LA-CHK-UC11
---
When a pattern rule names a `setting` and every use case in a domain that follows the pattern gives that setting as `Not applicable:` (in any letter case) with a reason, the rule MUST NOT be counted in that domain. If any following use case there gives the setting a value, the rule MUST be counted. A rule with no `setting` MUST be counted in every following domain.
