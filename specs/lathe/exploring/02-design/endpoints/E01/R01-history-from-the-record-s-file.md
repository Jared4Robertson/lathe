---
id: LA-EXP-E01-R01
kind: interaction_requirement
title: GET /api/history reads git safely for the record's own file
parent: LA-EXP-E01
links:
  fulfills: [LA-EXP-UC12-R05]
---
The endpoint MUST find the file from the specs by the record's ID and MUST answer 404 (`no-record`) for an ID no record has, never reading a path from the request. It MUST answer 400 for a missing ID, a negative `skip`, or a `commit` that is not a hex hash of 4 to 40 characters or `working`, and 404 (`no-commit`) for a commit that did not touch the file. It MUST run git with argument arrays, never through a shell, inside the product root, with no optional locks or prompts, stopped after a time limit and cut at an output cap (the answer says `truncated`). The list MUST follow renames, newest first, twenty commits a page with `more`, and say `uncommitted` (`modified` or `added`) when the working tree differs. A folder that is not a git repository, or a machine without git, MUST answer 200 with `no-repo` and a calm message. Answers carry `cache-control: no-store`.
