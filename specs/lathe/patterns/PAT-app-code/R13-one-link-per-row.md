---
id: LA-PAT-APP-CODE-R13
kind: pattern_rule
title: A row or card that leads to one record is one link
parent: LA-PAT-APP-CODE
---
A list row or a card that leads to one record MUST be clickable anywhere on it, through one real link (`<a href>`) to that record, marked `row-link`, whose `::after` stretches over the whole row (`position: absolute; inset: 0`, the row being `position: relative`), as a domain card's title link already does. A plain click navigates within the app; Cmd/Ctrl-click and middle-click open a new tab, because it is a real link. A row MUST have exactly one such link.

Every other control in the row (a fold chevron, another record link such as "followed by UC01", a badge with a tooltip, a button) MUST sit above the stretched link, through one shared rule rather than one per control, so a click on it does what it did before. The row takes the link's hover (the `--hover-bg` tint, the title in steel) and its focus ring, while keyboard focus stays on the one link. A row's plain text cannot be drag-selected; that is accepted. A list that does not navigate, such as the inspector's facts, is not a row of this kind.
