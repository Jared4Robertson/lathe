import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { main, openApp, section, stageOf } from './helpers';

// A domain's page reads its records in the five stages, each a heading in its stage's color with one
// section per kind that has records; a record folds the children of its own stage under it, and what
// sits under it in a later stage is listed in that stage (a command's endpoint, handler and tests).

const ids = (element: HTMLElement) => [...element.querySelectorAll('a.record-link code')].map((c) => c.textContent);

async function openShop() {
  await openApp('/DM-SHOP');
  await screen.findByRole('heading', { level: 1, name: 'Shopping' });
}

/** Each stage on the page: its heading's label, and the titles of the kind sections inside it. */
function stages() {
  return [...main().querySelectorAll('.stage')].map((s) => [
    s.querySelector('h2')?.childNodes[1]?.textContent,
    [...s.querySelectorAll('h3')].map((h) => h.firstChild?.textContent),
  ]);
}

describe('domain page', () => {
  it('LA-V91-R02-T01 The domain page groups records by stage, one section per kind, with what sits under a record in its stage folded under it', async () => {
    await openShop();
    const user = userEvent.setup();
    expect(stages()).toEqual([
      ['Domain model', ['Aggregates', 'Specifications', 'Read models', 'Terms']],
      // Use cases holds only use cases, so it lists them itself, with no folder heading: under their aggregates' headings.
      ['Use cases', ['Basket']],
      ['Interface design', ['Views', 'Endpoints']],
      ['Technical specification', ['Tables', 'Command handlers']],
      ['Test plan', ['Invariant tests', 'Use case tests']],
    ]);
    // Each stage carries its color and its count.
    const domainModel = main().querySelector('.stage.stage-domain-model') as HTMLElement;
    expect(domainModel.querySelector('h2 .stage-mark.stage-domain-model')).not.toBeNull();
    expect(domainModel.querySelector('h2')).toHaveTextContent(/^Domain model\s*4$/);

    // Domain model: the aggregate with its entities, invariant and event folded under it; the command sits under the
    // entity it changes, one level further down.
    const basket = within(section(/^Aggregates/)).getByRole('link', { name: /^DM-SHOP-A1\s*Basket/ }).closest('li') as HTMLElement;
    expect(basket).toHaveTextContent('4 children');
    expect(basket.querySelector('ul.nested')).toBeNull();
    await user.click(within(basket).getByRole('button', { name: 'Expand DM-SHOP-A1' }));
    expect(ids(basket.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-EN01', 'DM-SHOP-EN02', 'DM-SHOP-INV01', 'DM-SHOP-EV01']);
    expect(within(basket).queryByRole('link', { name: /^DM-SHOP-CMD01/ })).toBeNull();
    // The read model folds its query.
    expect(within(section(/^Read models/)).getByRole('link', { name: /^DM-SHOP-RM01/ }).closest('li')).toHaveTextContent('1 query');

    // Use cases: the use case under its aggregate's heading, folding its requirements and its flow.
    const add = within(stageOf('use-cases')).getByRole('link', { name: /^DM-SHOP-UC01\s*Add/ }).closest('li') as HTMLElement;
    expect(add.closest('section.record-group')!.querySelector('h3')).toHaveTextContent(/^Basket\s*Aggregate\s*1$/);
    expect(add).toHaveTextContent('3 children');
    await user.click(within(add).getByRole('button', { name: 'Expand DM-SHOP-UC01' }));
    expect(ids(add.querySelector('ul.nested') as HTMLElement)).toEqual(['DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02', 'DM-SHOP-UC01-FL']);

    // Interface design, technical specification and test plan list what starts a branch of their stage; a technical
    // record with what it names in code, a test with its level and file.
    expect(ids(section(/^Views/))).toEqual(['DM-V01']);
    expect(ids(section(/^Endpoints/))).toEqual(['DM-SHOP-EP01']);
    expect(section(/^Tables/)).toHaveTextContent('baskets');
    expect(ids(section(/^Command handlers/))).toEqual(['DM-SHOP-CMD01-H']);
    expect(section(/^Command handlers/)).toHaveTextContent('src/basket.ts');
    expect(ids(section(/^Use case tests/))).toEqual(['DM-SHOP-UC01-R01-T01']);
    expect(section(/^Use case tests/)).toHaveTextContent('service · test/basket.test.ts');
    // A test not automated yet is marked so.
    expect(within(section(/^Invariant tests/)).getByText('not automated yet')).toHaveClass('test-state', 'not-automated');
    // Both domains use the value object, so the product shares it: the domain does not list it. The view presents only
    // Shopping's command, so it sits here.
    expect(main()).not.toHaveTextContent('DM-VO01');
  });

  it('LA-V91-R03-T01 The search box filters records by ID or title as you type', async () => {
    await openShop();
    const user = userEvent.setup();
    const search = screen.getByLabelText('Filter records');

    await user.type(search, 'item added');
    // A match folded under a record opens it, just for the match.
    expect(ids(section(/^Aggregates/))).toEqual(['DM-SHOP-A1', 'DM-SHOP-EV01']);
    expect(within(section(/^Specifications/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'add item');
    // A match deeper down (the command under the aggregate's entity) opens the record and the entity that holds it.
    expect(ids(section(/^Aggregates/))).toEqual(['DM-SHOP-A1', 'DM-SHOP-EN01', 'DM-SHOP-CMD01']);
    expect(within(section(/^Specifications/)).getByText('Nothing matches.')).toBeInTheDocument();
    expect(within(section(/^Command handlers/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'cmd01-h');
    expect(ids(section(/^Command handlers/))).toEqual(['DM-SHOP-CMD01-H']);
    expect(within(section(/^Use case tests/)).getByText('Nothing matches.')).toBeInTheDocument();

    await user.clear(search);
    expect(ids(section(/^Use case tests/))).toEqual(['DM-SHOP-UC01-R01-T01']);
    expect(ids(section(/^Aggregates/))).toEqual(['DM-SHOP-A1']);
    expect(ids(stageOf('use-cases'))).toEqual(['DM-SHOP-UC01']);
  });

  it('LA-V91-R04-T01 The domain page lists its coverage gaps, each with the missing link, and its problems', async () => {
    await openShop();
    const coverage = section(/^Coverage/);
    const gaps = within(coverage).getAllByRole('listitem');
    expect(gaps.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/DM-SHOP-INV01.*Invariant not built/),
      expect.stringMatching(/DM-SHOP-INV01.*Invariant not proved/),
      expect.stringMatching(/DM-SHOP-UC01-R02.*UC requirement not built/),
      expect.stringMatching(/DM-SHOP-UC01-R02.*UC requirement not proved/),
    ]);
    // Gaps also show on the record's row.
    await userEvent.setup().click(within(section(/^Aggregates/)).getByRole('button', { name: 'Expand all' }));
    const row = within(section(/^Aggregates/)).getByRole('link', { name: /DM-SHOP-INV01/ }).closest('.record-row') as HTMLElement;
    expect(within(row).getByText('not proved')).toBeInTheDocument();

    const problems = within(section(/^Problems in this domain/)).getAllByRole('listitem');
    expect(problems.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^error.*DM-SHOP-UC01-R01-T01.*does not exist.*test-file-missing$/),
      expect.stringMatching(/^warning.*DM-SHOP-INV01.*not-proved$/),
      expect.stringMatching(/^warning.*DM-SHOP-UC01-R02.*not-proved$/),
    ]);
    expect(main()).not.toHaveTextContent('DM-PAY-UC01-R01');
  });

  it('LA-V91-R02-T01 A stage with nothing yet says so, and only kinds with records get a section', async () => {
    await openApp('/NF-NOTE');
    await screen.findByRole('heading', { level: 1, name: 'Notes' });
    expect(stages()).toEqual([
      ['Domain model', ['Aggregates']],
      ['Use cases', []],
      ['Interface design', []],
      ['Technical specification', []],
      ['Test plan', []],
    ]);
    const useCases = main().querySelector('.stage.stage-use-cases') as HTMLElement;
    expect(useCases).toHaveTextContent('Nothing yet.');
  });
});
