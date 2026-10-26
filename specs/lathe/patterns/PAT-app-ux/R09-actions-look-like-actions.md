---
id: LA-PAT-APP-UX-R09
kind: pattern_rule
title: Actions look like actions
parent: LA-PAT-APP-UX
group: Look and feel
---
A standalone action MUST be the app's one `Button` component (`app/src/components/Button.tsx`), never a link dressed as text and never a button with a style of its own:

- **Ghost**, the default: no border or fill, padded, the `--hover-bg` tint on hover, the shared focus ring and an optional leading icon. "Expand all", "Clear filters", "Open the product overview", Cancel, Export and the desktop app's file actions are ghost buttons.
- **Primary**: filled with the accent, for the one main action of a form or dialog, such as Open on a tapped graph node.
- **Icon**: a square ghost button that holds only an icon and MUST be given an accessible name, such as a pane's full-screen or close button.

An action that goes to an address is a real link drawn as a button (`buttonClass()` on a router link, or `Button` with `href`), so Cmd/Ctrl-click still opens a new tab. On a coarse pointer a button is a 44 px target (`LA-PAT-APP-UX-R07`).

Links stay links where they are navigation in context: inside prose (Markdown, or a sentence such as "See all products"), inside lists and rows (record references and the row links of `LA-PAT-APP-UX-R05`), in breadcrumbs and trails, and in the navigation. Controls that are not standalone actions keep their own form: tabs, toggles in a group (the view switches, the graph's depth), fold chevrons and the nav's rows.

Proved in `app/test/standards.test.tsx` by rendering the main pages and reading the source.
