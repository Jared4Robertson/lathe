---
id: LA-PAT-APP-CODE
kind: pattern
title: App code
parent: LA
---
How the web app's code is written, so that every page and every agent's change reads the same way and stays easy to change. The app lives in `app/src`; Browsing (`LA-BRW`) follows this pattern for all of it.

The rules come from problems the app has had: a button laid over a heading with CSS that overlapped the list below it, a page style that reached every `header` element, "Capabilitys" from a hand-made plural, and spelling that drifted between British and American.

## How a domain uses the pattern

The domain links the pattern with `follows`. The pattern has no settings: every rule applies to all of the domain's code. Each rule is proved by a test in `app/test/standards.test.tsx` that reads the source or renders the main pages, and that names the file and line to fix when it fails.

## Rules

- `LA-PAT-APP-CODE-R01`: layout lives in the markup.
- `LA-PAT-APP-CODE-R02`: styles are set by class.
- `LA-PAT-APP-CODE-R03`: colors and shadows are tokens.
- `LA-PAT-APP-CODE-R04`: generic components know nothing of specs.
- `LA-PAT-APP-CODE-R05`: kind labels become plural only through `plural()`, and lowercase only through `lowerLabel()`.
- `LA-PAT-APP-CODE-R06`: every control has an accessible name.
- `LA-PAT-APP-CODE-R07`: American spelling.
- `LA-PAT-APP-CODE-R08`: everything clickable shows a hover state.
- `LA-PAT-APP-CODE-R09`: the workbench, panels a gap apart and every gap resizes.
- `LA-PAT-APP-CODE-R10`: every grid says its columns.
- `LA-PAT-APP-CODE-R11`: each pane has one title bar that holds its views and layout actions.
- `LA-PAT-APP-CODE-R12`: motion is shared and optional.
- `LA-PAT-APP-CODE-R15`: themes only set tokens.
