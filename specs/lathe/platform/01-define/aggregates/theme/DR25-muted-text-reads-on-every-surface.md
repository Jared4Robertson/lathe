---
id: LA-PLT-DR25
kind: domain_rule
title: Text sits only on the surfaces the theme vouches for
parent: LA-PLT-A4
---
Body text and muted text MUST be drawn only on the surfaces whose contrast every built-in theme guarantees: the page (`--paper`) and a sheet (`--sheet`), which the theme contrast audit (`app/src/theme/audit.ts`) holds to 4.5:1 in light and dark. The shell (`--shell`) is the gap between panels and holds no text: a page that is one panel, such as Checks or Appearance, draws its own `--paper` background rather than let the shell show through.
