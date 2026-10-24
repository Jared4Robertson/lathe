---
id: LA-BRW-T88
kind: test
title: A list of up to 10 items is plain; a longer one scrolls inside, with search, a count and a no-match message
parent: LA-BRW
test_type: component
run_by: app/test/long-list.test.tsx
links:
  proves: [LA-BRW-UC30-R07]
---
Renders the long list with 10 and with 12 items. Expects no search box at 10; at 12, a focusable scrolling region, a search box reached by Tab that filters by ID and by title, a count that follows it, a message when nothing matches, and Escape clearing the search.
