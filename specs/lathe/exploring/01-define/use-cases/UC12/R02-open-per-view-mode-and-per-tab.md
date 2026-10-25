---
id: LA-EXP-UC12-R02
kind: requirement
title: The side bar keeps its open state and view per view mode and per tab
parent: LA-EXP-UC12
---
The side bar's view mode MUST be the Wiki view when only the wiki is open, and otherwise the Graph or Model view open beside it. Each mode MUST keep whether the side bar is open and which view it shows, per tab (`LA-EXP-UC10`) across a reload, and as last used for a space's first tab. Until the Reader chooses, it MUST be closed in the Wiki view and open on Details in the Graph and Model views. On a phone it MUST stay a bottom sheet (`LA-PLT-UC07-R04`) with the same three views.
