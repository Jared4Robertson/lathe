---
id: LA-BRW-C34
kind: component
title: Long list
parent: LA-BRW-LAY08
component_type: react component
file: app/src/components/LongList.tsx
links:
  satisfies: [LA-BRW-UC30-R07]
---
`LongList` takes items, a render function, a search-text function, a key function and a label. Up to 10 items it renders a plain list. Past 10 it adds a search box (Escape clears it), a live count, a "Nothing matches" status, and a focusable scrolling area whose height it measures from the first 10 rows, once and unfiltered, so filtering never makes it jump. Every list in the spec pages uses it, and it imports nothing from them, so the side bar uses it too.
