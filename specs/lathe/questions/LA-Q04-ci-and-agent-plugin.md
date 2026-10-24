---
id: LA-Q04
kind: question
title: When do the GitHub Action and the Claude Code plugin come?
parent: LA
owner: Jared
---
Both are planned as thin layers over the package: an Action that runs `lathe check` on every pull request and comments with coverage, and a plugin with skills (model a domain, write use cases) and a hook that runs `lathe check` after edits. Recommendation: the plugin first, since agents do most of the writing.
