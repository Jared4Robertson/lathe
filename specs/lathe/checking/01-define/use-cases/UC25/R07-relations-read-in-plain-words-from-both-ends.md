---
id: LA-CHK-UC25-R07
kind: requirement
title: Relations read in plain words from both ends
parent: LA-CHK-UC25
---
Each relation rule MUST carry a `forward_label`, the link read from its source ("Satisfies"), and a `reverse_label`, the link read from its target ("Designed by"), in sentence case. The reference MUST show both labels for each relation rule and list each kind's links out by their forward labels and its links in by their reverse labels. A product's extension MAY set or replace them. `lathe check` MUST report a `relation-unlabeled` error for a relation rule that lacks either label after the extensions are merged.
