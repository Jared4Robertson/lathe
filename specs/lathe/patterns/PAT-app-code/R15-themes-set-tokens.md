---
id: LA-PAT-APP-CODE-R15
kind: pattern_rule
title: Themes only set tokens
parent: LA-PAT-APP-CODE
group: Markup and style
---
Every visual value (color, font, text size, density, radius, gap and motion speed) MUST come from a token in `:root`, so that a theme can change it. A theme MUST be data that sets those tokens and nothing else: its file names token names only, and the stylesheet written from it MUST have no selector but `:root` and set only custom properties. Every built-in theme MUST pass WCAG AA in both its light and dark sets: body text, muted text and the accent at least 4.5:1 on the page and on a sheet.
