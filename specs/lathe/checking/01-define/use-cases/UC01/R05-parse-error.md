---
id: LA-CHK-UC01-R05
kind: requirement
title: A malformed record file is a parse error, not a crash
parent: LA-CHK-UC01
---
A record file that cannot be parsed (no header, bad YAML, a non-string field, `links` that is not a map of lists) MUST become an error problem `parse-error` whose message names the file's path. Loading MUST carry on with the other files.
