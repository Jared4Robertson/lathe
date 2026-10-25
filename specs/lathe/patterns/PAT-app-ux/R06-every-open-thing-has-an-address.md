---
id: LA-PAT-APP-UX-R06
kind: pattern_rule
title: Every open thing has an address
parent: LA-PAT-APP-UX
---
Anything a person can open MUST be reachable from the address bar or restorable from storage, so a reload brings it back as it was: a page and its views are in the address (`/records/<id>?view=wiki,graph`), and what the address cannot hold, such as the open tabs, which one is active and each tab's state, is kept in session or local storage and read back on load. A new kind of open thing (a tab, a view, a panel state worth sharing) MUST come with a test that opens it, reloads the app at the same address and expects the same thing open. Storage is read with guards (`readPref`), so a missing or malformed value falls back to a default and never breaks the page.
