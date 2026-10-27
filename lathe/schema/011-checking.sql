-- Checking: the checks, and the problems a run finds.

CREATE TYPE severity AS ENUM ('error', 'warning');
CREATE TYPE check_severity AS ENUM ('error', 'warning', 'error_or_warning');

CREATE TABLE "check" (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z0-9]+(-[a-z0-9]+)*')),
  product_id VARCHAR REFERENCES product (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  severity check_severity NOT NULL,
  summary VARCHAR NOT NULL CHECK (trim(summary) <> ''),
  explanation VARCHAR NOT NULL CHECK (trim(explanation) <> ''),
  query VARCHAR NOT NULL CHECK (trim(query) <> ''),
  kinds VARCHAR[]
);
COMMENT ON TABLE "check" IS 'A check: a query over the tables that returns a row (severity, check, record, message) for each problem it finds. An error means the workspace is broken; a warning is work still to do.';
COMMENT ON COLUMN "check".name IS 'The check''s name, in lower case with hyphens, such as test-proves-nothing.';
COMMENT ON COLUMN "check".product_id IS 'For a product''s own check, the product; none for Lathe''s checks.';
COMMENT ON COLUMN "check".position IS 'Its place in the run order, from 1: Lathe''s checks run first, then the product''s own.';
COMMENT ON COLUMN "check".severity IS 'What its rows report: error, warning, or error_or_warning when its rows say which.';
COMMENT ON COLUMN "check".summary IS 'What it reports, in one sentence.';
COMMENT ON COLUMN "check".explanation IS 'Why it matters, ending with how to fix what it reports.';
COMMENT ON COLUMN "check".query IS 'The SELECT that finds the problems.';
COMMENT ON COLUMN "check".kinds IS 'The kinds it concerns.';

CREATE TABLE problem (
  check_name VARCHAR NOT NULL,
  severity severity NOT NULL,
  record VARCHAR,
  message VARCHAR NOT NULL
);
COMMENT ON TABLE problem IS 'One problem a run of the checks found. Problems are the result of a run, never stored.';
COMMENT ON COLUMN problem.check_name IS 'The check that found it.';
COMMENT ON COLUMN problem.severity IS 'error or warning.';
COMMENT ON COLUMN problem.record IS 'The ID of the record it is about, if one.';
COMMENT ON COLUMN problem.message IS 'What is wrong and how to fix it.';

INSERT INTO meta_table VALUES ('check', 'checking', NULL), ('problem', 'result', NULL);
