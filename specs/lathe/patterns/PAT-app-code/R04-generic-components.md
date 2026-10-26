---
id: LA-PAT-APP-CODE-R04
kind: pattern_rule
title: Generic components know nothing of specs
parent: LA-PAT-APP-CODE
group: Components and words
---
A component in `app/src/components` MUST import only React and other generic components, never the spec pages, the graph, the shell or the data types. What a spec page needs from it comes in through props, such as a list's items, its row renderer and its label.
