---
id: LA-PLT-DR23
kind: domain_rule
title: A box that scrolls can be reached by keyboard
parent: LA-PLT-A5
---
A box that scrolls on its own and holds nothing that takes focus (a code block, the ERD's key, the shortcuts sheet's groups) MUST take focus itself (`tabindex="0"`) and be named as a region, so the arrow keys can scroll it.
