-- A domain event's title reads as something that happened, in the past tense.
--
-- An event is named for what happened, such as Loan opened or Payment sent (FORMAT.md section 18). The
-- check is a heuristic over the title's words, in any letter case and split at anything but a letter: the
-- title passes when its last word, or any word after its first (the word after a one-word subject, as in Loan
-- became overdue), is a past form. A past form is a word of four or more letters ending in "-ed", other than
-- the few such words that are not verbs in the past (need, seed, feed, speed, breed, bleed, embed, proceed,
-- exceed, succeed, hundred, naked, sacred, wicked), or one of the irregular past forms listed below. An empty
-- title is missing-title only. The heuristic can miss a past form it does not know, so this is a warning.
-- Name the event in the past tense, as what happened (Tool returned, not Return tool), or add the word to
-- the list here if it is a past form the check does not know.
--
-- Irregular past forms: arose, arisen, ate, eaten, awoke, awoken, became, begun, began, bent, bound, bit,
-- bitten, blew, blown, broke, broken, bred, brought, built, burnt, bought, caught, chose, chosen, came, cost,
-- crept, cut, dealt, dug, did, done, drew, drawn, dreamt, drank, drunk, drove, driven, fell, fallen, fed,
-- felt, fought, found, fled, flew, flown, forbade, forbidden, forgot, forgotten, forgave, forgiven, froze,
-- frozen, got, gotten, gave, given, went, gone, grew, grown, hung, had, heard, hid, hidden, hit, held, hurt,
-- kept, knew, known, laid, led, leant, learnt, left, lent, let, lit, lost, made, meant, met, mistook,
-- mistaken, overdone, overran, overridden, overrode, overtaken, overtook, paid, put, quit, read, rebuilt,
-- redone, remade, reran, rerun, reset, resent, resold, retook, retaken, rewound, rewrote, rewritten, rode,
-- ridden, rang, rung, rose, risen, ran, run, said, saw, seen, sought, sold, sent, set, shook, shaken, shone,
-- shot, showed, shown, shut, sang, sung, sank, sunk, sat, slept, slid, spoke, spoken, sped, spent, spun,
-- split, spread, sprang, sprung, stood, stole, stolen, stuck, struck, swore, sworn, swept, swam, swum,
-- swung, took, taken, taught, tore, torn, told, thought, threw, thrown, understood, undid, undone, upheld,
-- upset, withdrew, withdrawn, withheld, woke, woken, wore, worn, won, wound, wrote, written.
--
-- severity: warning
-- kinds: domain_event
WITH
  irregular (word) AS (
    SELECT unnest(string_split(
      'arose arisen ate eaten awoke awoken became begun began bent bound bit bitten blew blown broke broken bred '
      || 'brought built burnt bought caught chose chosen came cost crept cut dealt dug did done drew drawn dreamt '
      || 'drank drunk drove driven fell fallen fed felt fought found fled flew flown forbade forbidden forgot '
      || 'forgotten forgave forgiven froze frozen got gotten gave given went gone grew grown hung had heard hid '
      || 'hidden hit held hurt kept knew known laid led leant learnt left lent let lit lost made meant met mistook '
      || 'mistaken overdone overran overridden overrode overtaken overtook paid put quit read rebuilt redone remade '
      || 'reran rerun reset resent resold retook retaken rewound rewrote rewritten rode ridden rang rung rose risen '
      || 'ran run said saw seen sought sold sent set shook shaken shone shot showed shown shut sang sung sank sunk '
      || 'sat slept slid spoke spoken sped spent spun split spread sprang sprung stood stole stolen stuck struck '
      || 'swore sworn swept swam swum swung took taken taught tore torn told thought threw thrown understood undid '
      || 'undone upheld upset withdrew withdrawn withheld woke woken wore worn won wound wrote written', ' '))
  ),
  not_past (word) AS (
    SELECT unnest(string_split(
      'need seed feed speed breed bleed embed proceed exceed succeed hundred naked sacred wicked', ' '))
  ),
  events AS (
    SELECT path, id, title,
           string_split(trim(regexp_replace(lower(title), '[^a-z]+', ' ', 'g')), ' ') AS words
    FROM records
    WHERE kind = 'domain_event' AND regexp_matches(lower(coalesce(title, '')), '[a-z]')
  ),
  title_words AS (
    SELECT path, unnest(words) AS word, unnest(generate_series(1, len(words))) AS position, len(words) AS count
    FROM events
  ),
  past AS (
    SELECT DISTINCT w.path
    FROM title_words w
    WHERE (w.position > 1 OR w.position = w.count)
      AND (w.word IN (SELECT word FROM irregular)
           OR (length(w.word) >= 4 AND w.word LIKE '%ed' AND w.word NOT IN (SELECT word FROM not_past)))
  )
SELECT 'warning' AS severity, 'event-tense' AS "check", nullif(e.id, '') AS record,
       'Event ' || coalesce(nullif(e.id, ''), e.path) || ' is titled "' || trim(e.title)
       || '", which does not read as past tense; name it for what happened, such as "Loan opened" or "Tool '
       || 'returned".' AS message
FROM events e
WHERE e.path NOT IN (SELECT path FROM past)
ORDER BY record, message
