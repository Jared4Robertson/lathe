---
id: LA-PAT-APP-CODE
kind: pattern
title: App code
parent: LA
---
How the web app's code is written, so that every page and every agent's change reads the same way and stays easy to change: where layout and style live, colors as tokens, generic components, labels, accessible names and spelling. The app lives in `app/src`; Browsing (`LA-BRW`) follows this pattern for all of it. How the app behaves for the person using it (hover, the workbench, the page bar, motion, row links, addresses, touch and stability) is the App experience pattern, `LA-PAT-APP-UX`.

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
- `LA-PAT-APP-CODE-R10`: every grid says its columns.
- `LA-PAT-APP-CODE-R15`: themes only set tokens.

The numbers of the rules that moved to App experience (R08, R09, R11 to R14, R16 and R17) are not reused; new rules here continue from R19.
