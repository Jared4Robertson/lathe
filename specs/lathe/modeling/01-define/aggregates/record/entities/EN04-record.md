---
id: LA-MOD-EN04
kind: entity
title: Record
parent: LA-MOD-A2
role: root
links:
  has_many: [LA-MOD-EN05, LA-MOD-EN06, LA-MOD-EN07]
  refers_to: [LA-CHK-EN02]
---
One specification record: one Markdown file under `specs/`, with its header and its prose body.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The record's identity, unique across the workspace and never reused. | Text in the ID format. | TL-LEND-T05 |
| Kind | What sort of record it is. | Kind reference, from the meta-model. | test |
| Title | A short name; for a rule, the rule in a few words. | Text, not blank. | A tool that needs repair cannot be lent |
| Parent | The record this one belongs to. | Record reference, of a kind the record's kind allows; none only for a product. | TL-LEND |
| Product | The product the record sits under. | Derived record reference. | TL |
| Domain | The domain the record sits under, if any. | Derived record reference, or none above domain level. | TL-LEND |
| Body | The record's prose; a rule is stated in full here. | Markdown text. | Reports damage on a tool; borrowing it is refused. |
| Path | Where the record's file is. | File path, relative to the repo root. | specs/tool-library/lending/02-design/tests/T05.md |
