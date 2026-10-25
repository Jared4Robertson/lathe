---
id: LA-TRC-UC11-R07
kind: requirement
title: Every list stays at 10 rows and can be searched
parent: LA-TRC-UC11
---
Every list in the spec pages (the menu's domains, a domain's record groups and nested lists, coverage gaps, problems and checks, open questions, a record's children and links both ways, the fitness history) MUST show up to 10 items as a plain list. With more than 10 it MUST show the first 10 rows' height and scroll inside, with a search box above it that filters by ID and title, a count such as "12 of 48", and a clear message when nothing matches.

The search box MUST be reachable with Tab, Escape MUST clear it, and the scrolling area MUST take focus so it scrolls from the keyboard. The list MUST know nothing about specs, so other views can use it.
