---
id: LA-BRW-UC40-R06
kind: requirement
title: The graph is a component that any page can host
parent: LA-BRW-UC40
---
The graph MUST be a component that takes its focus (a record ID, or a parent ID and kind) and reports every move to a new center through a callback, without reading or changing the address itself, so a page can show it beside the record page in a split view. Its links MUST still carry a real address so they open in a new tab. It MUST fill the width and height its container gives it and fit the picture again when that size changes.
