---
id: LA-AUT-EN09
kind: entity
title: Domain rule
parent: LA-AUT-A3
role: child
---
A fact that must always hold for an aggregate's records, whatever use case changes them, under the aggregate or the entity it is about; a rule that holds across aggregates sits under the domain.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the rule's number. | Text in the ID format. | TL-LEND-DR05 |
| Title | The rule in a few words. | Text. | A tool that needs repair cannot be lent |
| Rule | The rule in full, with MUST, MUST NOT, SHOULD or MAY. | Markdown text. | A tool marked for repair MUST NOT be lent. |
