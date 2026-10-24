---
id: TL-LEND-E06-R03
kind: interaction_requirement
title: A damage report over 64 KB is refused with 413
parent: TL-LEND-E06
---
A request body over 64 KB MUST be refused with 413 `body_too_large` before it is parsed, so a long or endless note cannot use up the server's memory. The note is the API's only free text that can grow without bound; the same limit applies to every endpoint's body.
