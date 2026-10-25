---
id: LA-BRW-UC100-R03
kind: requirement
title: The current page's branch opens itself
parent: LA-BRW-UC100
---
Opening a page from the nav, or on the nav's first draw (a load, a reload, the nav expanded or opened as a drawer), MUST open the nav rows that hold it: a domain page its domain; a record page its domain, stage and folder (or Shared); a group page the folder of its kind. A page opened anywhere else (a link in the page, the graph, Back, quick find) MUST leave the nav's rows where they are (`LA-BRW-UC117-R02`): the closed row that holds the page is marked instead, and opening that row opens the branch down to the page.
