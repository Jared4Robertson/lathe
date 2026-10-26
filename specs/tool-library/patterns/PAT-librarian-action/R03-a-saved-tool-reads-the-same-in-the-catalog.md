---
id: TL-PAT-LIBRARIAN-ACTION-R03
kind: pattern_rule
title: A saved tool reads the same in the catalog
parent: TL-PAT-LIBRARIAN-ACTION
applies_when: record is Tool
---
When the action saves a tool, the catalog MUST then list that tool exactly as the action showed it, so that the librarian sees one state of the tool wherever they look.

The rule applies only where the action's `record` is a Tool: in a domain where every following use case saves something else, such as a member or a loan, it is waived.
