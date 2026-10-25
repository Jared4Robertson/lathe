---
id: LA-BRW-UC119-R04
kind: requirement
title: Outline lists what the main view holds, as rows to jump to
parent: LA-BRW-UC119
---
In the Wiki view Outline MUST list the page's sections and headings (Traceability and its groups, children, problems, the body's own headings) in page order and indented by level; a click MUST scroll the wiki to that heading, and the section in view MUST be marked (`aria-current="location"`) as the wiki scrolls. In the Graph view it MUST list the records in focus, not the context ring, grouped by level from left to right; in the Model view the diagram's boxes, those in focus first. Every list MUST be rows that are clickable anywhere (`LA-PAT-APP-UX-R05`) and searchable past ten rows (`LA-BRW-UC50-R07`).
