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

The pattern's rules are records under it, and every domain that follows the pattern proves each one in its own tests. Pattern rules need proof only, but TL-LEND's components still say, with `satisfies`, which code carries each rule out:

- `TL-PAT-LIBRARIAN-ACTION-R01`: an action missing its required input is refused and saves nothing (setting `required_input`).
- `TL-PAT-LIBRARIAN-ACTION-R02`: a successful action saves the record and shows it as stored.
- `TL-PAT-LIBRARIAN-ACTION-R03`: a saved tool reads the same in the catalog (applies when `record` is Tool).
