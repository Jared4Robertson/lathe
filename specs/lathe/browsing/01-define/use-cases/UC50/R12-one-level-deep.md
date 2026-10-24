---
id: LA-BRW-UC50-R12
kind: requirement
title: Wiki pages and the inspector open one level deep
parent: LA-BRW-UC50
---
A product page MUST list its domains (and its fitness, evidence and questions) but not their contents; a domain page its direct children grouped by kind (Aggregates, Use cases, Flows, Views, Endpoints, Components, Tests, Open questions, and any other kind such as capabilities, in their `order`), each row showing its count of children; a record page its fields, body, direct children and links; a group page its members. Each row with children MUST have a disclosure button (`aria-expanded`, a chevron) and each section an Expand all / Collapse all button. What is opened MUST be remembered for the session while moving around. A search inside a section MUST reveal matching nested records by opening their row just for the match. Right arrow MUST open a row (or move into it) and Left close it (or move to its parent). The command palette MUST offer Expand all and Collapse all for the page.
