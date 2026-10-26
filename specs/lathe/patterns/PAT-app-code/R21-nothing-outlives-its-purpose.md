---
id: LA-PAT-APP-CODE-R21
kind: pattern_rule
title: Nothing outlives its purpose
parent: LA-PAT-APP-CODE
group: Change
---
When a behavior is removed or replaced, everything that only served it MUST go in the same change: its code, exports, files and dependencies, its styles, its commands and icons, its tests and its records. The code MUST NOT keep a file, export or dependency nothing uses, a class selector nothing draws, a command nothing handles or nothing can reach, or an icon nothing shows. Every mark the Graph or the Model view can draw (a box's shape or fill, a badge, a line style) MUST be listed in that view's key with what it means: a mark that can't be explained can't ship. Each of these is checked, so a leftover fails instead of surviving because nobody remembered it.
