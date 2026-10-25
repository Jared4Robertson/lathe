---
id: LA-TRC-UC02-R02
kind: requirement
title: Design and proof links are found by their role
parent: LA-TRC-UC02
---
Coverage and the `unsatisfied` and `unproved` checks MUST treat a link as design or proof only by its relation rule's `role` (`design` or `proof`) for the link's source and target kinds, so that a relation an extension adds with a role counts like `satisfies` or `proves`.
