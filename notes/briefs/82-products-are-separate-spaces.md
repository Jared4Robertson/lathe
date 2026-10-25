# Brief: each product is a separate space (hard separation)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner: "each product gets its own graph. Have a hard separation between products. They're completely different spaces and spaces should scope to that product only."

Today separation is partial:
- the nav and tabs are per space;
- but the graph map (`app/src/graph/map.ts`) roots every product in one picture;
- quick find searches the current space first and then the others;
- Checks lists every product, with an optional filter, and the rail has a Checks item above all products;
- nothing stops a record linking into another product.

## Decisions (recommended; apply them, hard cutover)
1. **Graph:** one map per product, built from that product's tree only, with the product as the single root. No node, link, hint or minimap content from another product. Switching space shows that product's own map.
2. **Quick find:** searches the current space only. Nothing from another product appears; switching product is the rail's job.
3. **Checks:** each space has its own Checks page, inside the space, listing only that product's problems.
   - Remove the global Checks rail item, the cross-product list and its space filter.
   - Problems that belong to no product (a broken meta-model or config) show on every space's Checks page, under a "Workspace" heading.
   - The desktop Dock badge counts the window's own product.
4. **Everything else follows the space:** the side bar (Details, Outline, History), the Model view, the format reference's "where the X are" links, the trail, hover cards, saved tabs and the last page per space. No view or count shows another product.
5. **Links:** a new engine check, `link-crosses-product` (error). A link, `involves`, `applies` or any other relation from a record in one product to a record in another is an error. Prose citations of another product's IDs are not mentions: they render as plain text.
6. **`/` stays the space chooser:** the list of products, the only page outside a space, as the rail's home. It shows each product's name and domain count, with no problems or coverage from inside the products.
7. **Remove** whatever only served cross-product views, following the removal sweep rule, and list it.

## Specs
- **Platform** (spaces, rail, Checks placement): the space aggregate, if it's there, and the workbench use cases.
- **Exploring:** the graph map rule, quick find and the side bar.
- **Checking:** the new check, and Checks per space.
- **Authoring:** the rule that records link only within their product.

Rewrite the records that promise cross-product behavior; delete those that only promise it. IDs continue from the highest in each kind per slice.

## Scope
- **Running at the same time:**
  - brief 80 (graph text scale and chevron) owns `app/src/graph/**`;
  - brief 81 (leftover checks: knip, unused CSS, marks in the key).
- Keep your graph change to the map's root selection and what feeds it. Merge main before reporting, and keep both sides.

## Checks
- The full checks from the common rules, plus the stability and a11y suites, once each with one worker.
- In a browser, with both products (Lathe and the Tool Library), confirm that no screen in one space shows anything from the other: graph, quick find, Checks, side bar and Model view.
- Never use port 5199.

## Report
The branch and its last commit, files changed, what was removed, the checks you ran and their results, and anything left open.
