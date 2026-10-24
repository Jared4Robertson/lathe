---
id: TL-PAT-LIBRARIAN-ACTION
kind: pattern
title: Librarian action
parent: TL
settings: record required_input result
---
A librarian at the desk enters a few details, and the library saves one record and shows what it saved. Registering a member, adding a tool, taking a return and reporting damage all work this way.

## How a use case uses the pattern

The use case links the pattern with `follows` and gives each setting as a header field: a value, or `Not applicable:` and a reason.

## Settings

| Setting | What the use case decides |
| --- | --- |
| `record` | The record the action saves or changes. |
| `required_input` | What the librarian must enter for the action to go ahead. |
| `result` | What the library shows the librarian once the record is saved. |

## Rules

- When the librarian leaves out any of the `required_input`, the library MUST refuse the action, say what is missing, and save nothing.
- When the action succeeds, the library MUST save the `record` and show the `result` as now stored, so that the librarian can copy an ID onto a card or tag or tell the member the outcome.
