---
id: LA-PLT-UC08-R01
kind: requirement
title: Below 900 px wide the app has a compact top bar and fits the screen
parent: LA-PLT-UC08
group: Layout
---
Below 900 px wide the app MUST take its phone layout. Its top bar MUST hold the menu button, the page's title on one line (cut with an ellipsis) under a link one step up (to the record's parent, a domain's product, or all products, keeping the view in front), and a quick find button. The layout MUST fill the screen's dynamic height (`100dvh`), keep its bars and sheets clear of the safe areas (`env(safe-area-inset-*)`, with `viewport-fit=cover`), and no page MUST scroll sideways at 320 px wide.
