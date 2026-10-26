---
id: LA-AUT-UC16-R03
kind: requirement
title: A standard rule nothing meets or cites is a warning
parent: LA-AUT-UC16
---
`lathe check` MUST report a `standard-rule-unmet` warning for each standard rule that no record meets and that no other record of its product cites, a citation from the rule's own standard not counting. The message MUST say how to link what follows the rule.
