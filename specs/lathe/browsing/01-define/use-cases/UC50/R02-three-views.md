---
id: LA-BRW-UC50-R02
kind: requirement
title: The page header switches between Wiki, Graph and Split
parent: LA-BRW-UC50
---
The header of a record, group, product or domain page MUST offer three views, Wiki, Graph and Split, as toggle buttons with a pressed state, a visible focus ring and their shortcut in their tooltip. The chosen view MUST be remembered between visits (local storage) and written to the address as `?view=wiki|graph|split`, so a shared link opens as it was seen. Switching views MUST NOT lose keyboard focus: when the focused element goes away with its pane, focus MUST move to the pressed toggle.
