---
id: LA-BRW-UC119-R05
kind: requirement
title: History lists the commits that changed the record's file and shows each one's diff
parent: LA-BRW-UC119
---
History MUST list the commits that touched the selected record's spec file (or the page's record), following renames, newest first, each with its date, author, subject and short hash, twenty at a time with "Load more". Changes in the working tree not committed yet MUST come first, labeled "Not committed". Choosing a row MUST show that commit's diff of the file inline, one at a time, as a unified diff whose added and removed lines are marked with the theme's tokens. When the product folder is not a git repository, or git is missing, it MUST say so calmly, as a hint, not an error. A group has no file, and says so.
