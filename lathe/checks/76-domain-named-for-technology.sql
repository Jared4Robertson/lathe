-- A domain is named for a technology layer or delivery channel rather than a business capability.
--
-- A domain is a vertical slice of business capability (FORMAT.md section 18): it owns its records and rules,
-- its views, its code and its tests, and technology is a layer inside its Design stage. A domain whose title
-- or domain code (its ID after the product prefix, such as LEND in TL-LEND) names a technology splits one
-- capability across several domains. The words are web app, frontend, front end, backend, back end, API, UI,
-- server, database, DB, desktop, mobile, engine, infrastructure, infra and Electron, matched as whole words
-- in any letter case, with or without a space or hyphen inside the two-word ones, and in the plural. Only the
-- title and code are read, never the body, which may well say which technologies the domain uses. Name the
-- domain for the capability it serves, and make the technology a layer in each domain's Design stage.
--
-- severity: warning
-- kinds: domain
SELECT 'warning' AS severity, 'domain-named-for-technology' AS "check", id AS record,
       'Domain ' || id || ' is named for a technology, not a business capability: '
       || CASE WHEN in_title <> '' THEN 'its title "' || trim(title) || '" says "' || in_title || '"' ELSE '' END
       || CASE WHEN in_title <> '' AND in_code <> '' THEN ' and ' ELSE '' END
       || CASE WHEN in_code <> '' THEN 'its code ' || code || ' says "' || in_code || '"' ELSE '' END
       || '; name the domain for the capability it serves, and make the technology a layer in each domain''s '
       || 'Design stage.' AS message
FROM (
  SELECT id, title, code,
         regexp_extract(lower(coalesce(title, '')), '(^|[^a-z])(' || words || ')([^a-z]|$)', 2) AS in_title,
         regexp_extract(lower(code), '(^|[^a-z])(' || words || ')([^a-z]|$)', 2) AS in_code
  FROM (
    -- Each domain's code is its ID after the product prefix.
    SELECT id, title,
           CASE WHEN parent IS NOT NULL AND starts_with(id, parent || '-') THEN substr(id, length(parent) + 2)
                ELSE id END AS code
    FROM records
    WHERE kind = 'domain' AND id <> ''
  ),
  (SELECT 'web[ -]?apps?|front[ -]?ends?|back[ -]?ends?|apis?|uis?|servers?|databases?|dbs?|desktops?|mobile'
          || '|engines?|infrastructure|infra|electron' AS words)
)
WHERE in_title <> '' OR in_code <> ''
ORDER BY record
