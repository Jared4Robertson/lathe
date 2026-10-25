# Brief: addresses are bare IDs; one page per product and domain

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after the UI agents running when this was written have merged: briefs 49 (themes), 52 (mobile), 53 (jitter) and 54 (ghost buttons). Work in your own worktree, and finish with your branch ready to merge.

## Goal
Addresses today:
- `/records/<ID>`: any record;
- `/records/<parent>/<kind>`: a group;
- `/specs/<product>` and `/specs/<product>/<domain>`: the product and domain overviews;
- old `/graph/…` addresses, which redirect.

Products and domains therefore have two different pages each (the overview and a generic record page), and every address carries a prefix. Jared decided the following.

## Decisions already made (Jared)
1. **Records:** a record's address is its bare ID, as in `/LA-BRW-UC01` and `/TL-LEND-EN04`. The views stay in the query (`?view=wiki,graph`).
2. **Groups:** a group's address is `/<parent-ID>/<kind>`, as in `/LA-BRW/use_case`. Group paths under it, such as the test plan groups from brief 37 (`/DM-SHOP/test/acceptance/…`), follow the same form.
3. **One page per product and domain:** their overview, at their ID (`/LA`, `/LA-BRW`). There is no separate generic record page for them. Their inspector still shows the record's facts (kind, file, parent, children, links). Make sure nothing the generic page showed is lost: links in and out, problems, and the body.
4. **Old addresses redirect** with a history replace, keeping the query and hash:
   - `/records/<ID>` to `/<ID>`;
   - `/records/<parent>/<kind>…` to `/<parent>/<kind>…`;
   - `/specs/<product>` to `/<product>`, and `/specs/<product>/<domain>` to `/<domain>`;
   - `/specs` (all products) to the product list at `/`;
   - `/graph/…` to the new form.
   
   Existing links, tabs saved in storage (brief 41) and bookmarks keep working. Migrate the saved tabs to the new form when you read them.
5. **App pages stay lowercase**, so they never clash with an ID:
   - `/` (the product list, or the last space);
   - `/checks`;
   - `/format` and its reference pages (brief 51);
   - `/settings/appearance` (brief 49);
   - `/diagrams/<slug>`.
   
   IDs match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`, and an app page starts with a lowercase letter.
6. **Every place that makes an address** goes through one function: `addressOf` in `app/src/views/address.ts`, which already exists. Update it, and find and remove any hand-built `/records/` or `/specs/` strings:
   - the nav, quick find and the inspector;
   - the graph's `hrefFor`, the ERD and tabs;
   - mentions in prose, the desktop menus (Help › Record format and so on) and the plugin docs.
7. **The server:** `lathe serve` and the Vite plugin serve `index.html` for any path that isn't `/api/*` or a static file. Check that this covers `/<ID>` paths, in the desktop app too.

## Proactive standard
Add `LA-PAT-APP-CODE-R19`, "One address per thing":
- a record's address is its bare ID, and a group's is its parent's ID plus its kind;
- app pages are lowercase words;
- every address is built by `addressOf`, the one function that makes them.

Prove it in `app/test/standards.test.tsx`:
- no source file outside `address.ts` builds a path with a template that starts with `/records`, `/specs` or `/${…id…}`;
- every route the router knows is either an ID pattern or starts lowercase;
- a table test that maps each old path to its redirect.

## Records
- Update the address requirements: `LA-BRW-UC40-R03` (a group's address), the UC50 requirements on addresses and views, `UC20-R07` (entry points), `UC112` (tabs) and the domain rules that name `/records` or `/specs`.
- Search `specs/` for `/records/` and `/specs/`, and update every record that states an address.
- New domain rules from `LA-BRW-DR280`, components from `LA-BRW-C270` and tests from `LA-BRW-T520`.
- R19 goes in the App code pattern.
- Update `lathe/FORMAT.md` and `lathe/README.md` where they show app addresses.

## Scope
- **You own:** routing and addresses across `app/src/**`, the server fallback in `lathe/src/server/serve.ts` and `app/server/lathe.ts` if needed, `desktop/src/menu.ts` (paths only), tests, docs, and the records above.
- Check which agents are running when you start, and stay out of their files beyond the address call sites.
- Never use port 5199. Use `npx vite --port 5416` in `app/` and stop it. Run brief 53's stability suite if it exists.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and a table of old and new addresses.
