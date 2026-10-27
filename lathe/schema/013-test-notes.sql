-- A test's notes: what its Given, When and Then do not say, such as why a test is manual and when to run it.

ALTER TABLE test ADD COLUMN notes VARCHAR;
COMMENT ON COLUMN test.notes IS 'Longer notes on the test, such as why it is manual, when to run it or how its code is keyed.';
