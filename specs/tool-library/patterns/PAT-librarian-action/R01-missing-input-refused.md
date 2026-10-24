---
id: TL-PAT-LIBRARIAN-ACTION-R01
kind: pattern_rule
title: An action missing its required input is refused and saves nothing
parent: TL-PAT-LIBRARIAN-ACTION
setting: required_input
---
When the librarian leaves out any of the `required_input`, the library MUST refuse the action, say what is missing, and save nothing.

A use case whose action needs no input marks `required_input` as `Not applicable:` with a reason; when every use case in a domain that follows the pattern does so, this rule does not apply in that domain.
