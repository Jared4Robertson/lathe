---
id: LA-PLT-T130
kind: test
title: Every class selector in the app stylesheets is used in app/src
parent: LA-PLT
test_type: unit
run_by: app/test/unused-css.test.ts
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Reads every stylesheet in `app/src` and expects each class in a selector to be named in `app/src` or `app/index.html`, or built by a class-building template literal (such as `stage-${stage}`) whose suffix the source names; each failure names the selector, its file and its line.
