---
id: LA-PLT-T65
kind: test
title: Quick find on a phone is a full-screen sheet
parent: LA-PLT
test_type: acceptance
run_by: app/test/mobile.test.tsx
links:
  proves: [LA-PLT-UC08-R06, LA-PLT-DR17]
---
On a phone, opens quick find from the top bar and expects a dialog with the box focused, the results inline under it, a choice going to the record and closing the sheet, and Escape closing it with focus back on the button.
