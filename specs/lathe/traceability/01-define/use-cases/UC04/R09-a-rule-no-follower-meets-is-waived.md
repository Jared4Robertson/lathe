---
id: LA-TRC-UC04-R09
kind: requirement
title: A pattern rule no follower meets is waived in that domain
parent: LA-TRC-UC04
---
A pattern rule with an `applies_when` MUST be owed in a domain only when at least one follower there (a use case that follows the pattern, or the domain when it follows the pattern itself) gives that setting a value, not `Not applicable:`, that meets it, compared trimmed and in any letter case. Elsewhere the rule MUST be waived: neither owed nor proved, so it adds nothing to that domain's coverage, gaps, `unproved` or `unsatisfied` warnings, and a test there that proves it proves nothing counted. A rule is owed only when Not applicable by setting (LA-TRC-UC04-R04) does not take it away either.
