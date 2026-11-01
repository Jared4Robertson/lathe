import { readFileSync } from 'node:fs';
import type { ServedData } from './read-view';
import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// The Journey page and its editor (LA-AUT-A25's page, LA-V156), and the places a journey shows on other pages: a
// product's Discovery (LA-V51-R13), an outcome's Journeys (LA-V110-R05), a use case's and a policy's In journeys
// (LA-V101-R13, LA-V132-R07) and a record's Serves line.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

/**
 * The demo shop with a policy (hears Item added, sends Add item), two outcomes and two journeys. DM-JR01 "Buy
 * something" serves DM-BO01: main path 1 add an item (DM-SHOP-UC01), 2 a handoff (DM-SHOP-PO01), 3 pay (DM-PAY-UC01),
 * 4 a step with nothing yet; and the path "pays later" with one step (DM-PAY-UC01); with a journey test.
 * DM-JR02 "Fill a basket" is the one step DM-SHOP-UC01.
 */
function withJourneys(): ServedData {
  const w = workspace();
  addRows(w, 'policy', { id: 'DM-SHOP-PO01', title: 'Recount the basket', command_id: 'DM-SHOP-CMD01', statement: 'Whenever an item is added, the shop MUST recount the basket.' });
  addRows(w, 'hears', { source_id: 'DM-SHOP-PO01', target_id: 'DM-SHOP-EV01' });
  addRows(
    w,
    'business_outcome',
    { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More of the baskets shoppers fill are checked out.', measure: 'Baskets checked out over baskets started, each week.', target: 'Two in three within a quarter.' },
    { id: 'DM-BO02', title: 'Quick payment', product_id: 'DM', statement: 'Shoppers pay quickly.', measure: 'Median days from a basket filled to its payment.', target: 'Under one day.' },
  );
  addRows(
    w,
    'journey',
    { id: 'DM-JR01', title: 'Buy something', product_id: 'DM', trigger: 'A shopper wants an item.', result: 'The shopper has paid for the basket.', notes: 'Where the shopper waits is the payment.' },
    { id: 'DM-JR02', title: 'Fill a basket', product_id: 'DM', trigger: 'A shopper picks an item.', result: 'The basket holds it.' },
  );
  addRows(
    w,
    'journey_step',
    { id: 'DM-JR01-S01', title: 'The shopper adds an item', journey_id: 'DM-JR01', path: 'main', position: 1 },
    { id: 'DM-JR01-S02', title: 'The shop recounts the basket', journey_id: 'DM-JR01', path: 'main', position: 2 },
    { id: 'DM-JR01-S03', title: 'The shopper pays by card', journey_id: 'DM-JR01', path: 'main', position: 3 },
    { id: 'DM-JR01-S04', title: 'The shop sends a receipt', journey_id: 'DM-JR01', path: 'main', position: 4 },
    { id: 'DM-JR01-S05', title: 'The shopper pays at pickup', journey_id: 'DM-JR01', path: 'pays later', position: 1 },
    { id: 'DM-JR02-S01', title: 'The shopper puts the item in', journey_id: 'DM-JR02', path: 'main', position: 1 },
  );
  addRows(
    w,
    'carries_out',
    { source_id: 'DM-JR01-S01', target_id: 'DM-SHOP-UC01' },
    { source_id: 'DM-JR01-S02', target_id: 'DM-SHOP-PO01' },
    { source_id: 'DM-JR01-S03', target_id: 'DM-PAY-UC01' },
    { source_id: 'DM-JR01-S05', target_id: 'DM-PAY-UC01' },
    { source_id: 'DM-JR02-S01', target_id: 'DM-SHOP-UC01' },
  );
  addRows(w, 'serves', { source_id: 'DM-JR01', target_id: 'DM-BO01' }, { source_id: 'DM-JR01', target_id: 'DM-BO02' });
  addRows(w, 'journey_test', { id: 'DM-JR01-T', title: 'A shopper buys an item', journey_id: 'DM-JR01', level: 'browser', state: 'not automated yet', steps: ['Add an item.', 'Pay by card.'], expected_result: 'The payment is taken.' });
  return w;
}

/** The steps of a list, by step ID. */
const stepIds = (list: HTMLElement) => within(list).getAllByRole('listitem').filter((li) => li.hasAttribute('data-step')).map((li) => li.getAttribute('data-step'));
const mainSteps = () => within(main()).getByRole('list', { name: 'Steps of the main path' });

describe('LA-V156-R01-T01 a journey\'s page reads it through its own query', () => {
  it('reads GET /api/journey/get-journey for the journey and again for one of its steps', async () => {
    const { requests } = await openApp('/DM-JR01', { data: withJourneys() });
    expect(await within(main()).findByText('The shopper has paid for the basket.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/journey/get-journey?id=DM-JR01');
    expect(within(main()).getByText('From').parentElement).toHaveTextContent('From A shopper wants an item. to The shopper has paid for the basket.');
    expect(within(main()).getByRole('list', { name: 'Outcomes DM-JR01 serves' })).toHaveTextContent('DM-BO01');
    await openApp('/DM-JR01-S03', { data: withJourneys() });
    expect((await within(main()).findAllByRole('link', { name: /DM-PAY-UC01/ })).length).toBeGreaterThan(0);
    expect(within(main()).getByText('Path').closest('div')).toHaveTextContent('main');
  });
});

describe('LA-V156-R04-T01 a journey\'s steps show in order a list per path, with who acts and what each carries out', () => {
  it('lists the main path first, each row with its number, title, link, actors and capability and domain or event and command', async () => {
    await openApp('/DM-JR01', { data: withJourneys() });
    await within(main()).findByRole('list', { name: 'Steps of the main path' });
    expect(stepIds(mainSteps())).toEqual(['DM-JR01-S01', 'DM-JR01-S02', 'DM-JR01-S03', 'DM-JR01-S04']);
    const headings = within(main()).getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((n) => n?.endsWith(' path'));
    expect(headings).toEqual(['Main path', 'Pays later path']);
    const [first, handoff, pay] = within(mainSteps()).getAllByRole('listitem');
    // A use case step: its kind, link, actor, capability and domain.
    expect(first).toHaveTextContent('The shopper adds an item');
    expect(within(first).getByRole('link', { name: /DM-SHOP-UC01/ })).toHaveAttribute('href', '/DM-SHOP-UC01');
    expect(first.querySelector('[data-meta="actors"]')).toHaveTextContent('Shopper');
    expect(first.querySelector('[data-meta="place"]')).toHaveTextContent('Buying');
    // A handoff: the product acts; it hears an event and sends a command.
    expect(handoff.querySelector('[data-meta="carries-out-kind"]')).toHaveTextContent('Handoff');
    expect(handoff.querySelector('[data-meta="actors"]')).toHaveTextContent('The product');
    expect(handoff.querySelector('[data-meta="place"]')).toHaveTextContent('hears DM-SHOP-EV01 → sends DM-SHOP-CMD01');
    expect(pay).toHaveTextContent('Paying');
    // The lane strip is for the eye: hidden from assistive technology, and the list is the order.
    const lanes = main().querySelector('.journey-lanes');
    expect(lanes).toHaveAttribute('aria-hidden', 'true');
    expect(lanes).toHaveTextContent('The product');
    // On a phone the strip is not drawn at all: only the list shows (the stylesheet hides it below 600px).
    expect(readFileSync('src/authoring/journey/journey.css', 'utf8')).toMatch(/@media \(max-width: 600px\) \{ \.journey-lanes \{ display: none; \} \}/);
  });
});

describe('LA-V156-R06-T01 a journey\'s page shows its proof line and each step\'s', () => {
  it('shows the counts and the journey test, and marks a step not proved', async () => {
    await openApp('/DM-JR01', { data: withJourneys() });
    const line = await within(main()).findByText(/^Not proved yet: /);
    expect(line).toHaveTextContent(/5 steps · \d proved · 1 carrying out nothing yet · journey test not proved/);
    const first = within(mainSteps()).getAllByRole('listitem')[0];
    expect(first.querySelector('[data-proof]')).toHaveAttribute('data-proof', 'not-proved');
    // The step that carries out nothing yet has no proof to show.
    expect(within(mainSteps()).getAllByRole('listitem')[3].querySelector('[data-proof]')).toBeNull();
    expect(within(main()).getByRole('heading', { name: /^Journey test/ }).closest('section')).toHaveTextContent('DM-JR01-T');
  });
});

describe('LA-V156-R02-T01 the Journey editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a journey with only what changed', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-JR01', { data: withJourneys(), command: () => ({ answer: ok }) });
    await within(main()).findByText('The shopper has paid for the basket.');
    expect(within(toolbar('DM-JR01')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add journey step', 'Remove']);
    await user.click(within(toolbar('DM-JR01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-JR01' });
    const result = within(form).getByRole('textbox', { name: /^result/ });
    await user.clear(result);
    await user.type(result, 'The shopper has paid.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/journey/change-journey', input: { id: 'DM-JR01', result: 'The shopper has paid.' } }]));
  });

  it('Add a step puts it on the main path after the last, with the next free ID, as Add a journey step', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-JR02', { data: withJourneys(), command: () => ({ answer: ok }) });
    await within(main()).findByText('The basket holds it.');
    await chooseAdd(user, toolbar('DM-JR02'), 'Journey step');
    const form = screen.getByRole('form', { name: 'Add a journey step' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-JR02-S02'));
    expect(within(form).getByRole('textbox', { name: /^path/ })).toHaveValue('main');
    expect(within(form).getByRole('spinbutton', { name: /^position/ })).toHaveValue(2);
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'The shopper checks out');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^carries out/i }), 'DM-PAY-UC01');
    await user.click(within(form).getByRole('button', { name: 'Add journey step' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/journey/add-journey-step', input: { journey_id: 'DM-JR02', id: 'DM-JR02-S02', title: 'The shopper checks out', path: 'main', position: 2, carries_out: 'DM-PAY-UC01' } }]));
  });

  it('Move up and Move down send Move a journey step with the neighbor\'s position, and the ends offer one', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-JR01', { data: withJourneys(), command: () => ({ answer: ok }) });
    await within(main()).findByRole('list', { name: 'Steps of the main path' });
    const [first, second, , last] = within(mainSteps()).getAllByRole('listitem');
    expect(within(first).queryByRole('button', { name: /^Move up/ })).toBeNull();
    expect(within(last).queryByRole('button', { name: /^Move down/ })).toBeNull();
    await user.click(within(second).getByRole('button', { name: 'Move up DM-JR01-S02' }));
    await user.click(within(second).getByRole('button', { name: 'Move down DM-JR01-S02' }));
    await waitFor(() => expect(commands).toEqual([
      { route: '/api/journey/move-journey-step', input: { id: 'DM-JR01-S02', position: 1 } },
      { route: '/api/journey/move-journey-step', input: { id: 'DM-JR01-S02', position: 3 } },
    ]));
  });

  it('Remove sends Remove a journey after saying what goes with it', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-JR02', { data: withJourneys(), command: () => ({ answer: ok }) });
    await within(main()).findByText('The basket holds it.');
    await user.click(within(toolbar('DM-JR02')).getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('list', { name: 'What goes with DM-JR02' })).toHaveTextContent('DM-JR02-S01');
    await user.click(screen.getByRole('button', { name: 'Remove DM-JR02' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/journey/remove-journey', input: { id: 'DM-JR02' } }]));
  });
});

describe('LA-V156-R03-T01 a refused Journey command shows every reason and keeps the page on the record', () => {
  it('shows the refusal of a step added at a position its path already has, and stays on the journey', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'step-order', table: 'journey_step', key: 'DM-JR02-S02', message: 'Position 1 of the main path of DM-JR02 is already DM-JR02-S01' }] };
    await openApp('/DM-JR02', { data: withJourneys(), command: () => ({ answer: refusal }) });
    await within(main()).findByText('The basket holds it.');
    await chooseAdd(user, toolbar('DM-JR02'), 'Journey step');
    const form = screen.getByRole('form', { name: 'Add a journey step' });
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Again');
    await user.click(within(form).getByRole('button', { name: 'Add journey step' }));
    expect(await screen.findByText(/already DM-JR02-S01/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/DM-JR02');
  });
});

describe('LA-V156-R05-T01 a step with nothing yet offers Add use case, which adds it and links the step', () => {
  it('says No use case yet, opens the use case adder with the step\'s title, then links the step', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-JR01', { data: withJourneys(), command: () => ({ answer: ok }) });
    await within(main()).findByRole('list', { name: 'Steps of the main path' });
    const unlinked = within(mainSteps()).getAllByRole('listitem')[3];
    expect(unlinked).toHaveTextContent('No use case yet');
    await user.click(within(unlinked).getByRole('button', { name: 'Add a use case for DM-JR01-S04' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /^Capability/ }), 'DM-PAY-CAP01');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const form = await screen.findByRole('form', { name: 'Add a use case' });
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('The shop sends a receipt');
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-PAY-UC02'));
    await user.type(within(form).getByRole('textbox', { name: /^goal/ }), 'The shop sends the receipt.');
    await user.click(within(form).getByRole('button', { name: 'Add use case' }));
    await waitFor(() => expect(commands.map((c) => c.route)).toEqual(['/api/use-case/add-use-case', '/api/journey/change-journey-step']));
    expect(commands[1].input).toEqual({ id: 'DM-JR01-S04', carries_out: 'DM-PAY-UC02' });
  });
});

describe('LA-V101-R13-T01 a use case names the journeys it is a step of, with its neighbors', () => {
  it('shows In journeys with each journey and its previous and next steps as links, and no fact on a use case in none', async () => {
    await openApp('/DM-SHOP-UC01', { data: withJourneys() });
    const fact = (await within(main()).findByRole('list', { name: 'Journeys DM-SHOP-UC01 is a step of' }));
    const [one, two] = within(fact).getAllByRole('listitem');
    expect(one).toHaveTextContent('Step 1 of DM-JR01Buy something');
    expect(one.querySelector('[data-meta="next"]')).toHaveTextContent('next: DM-JR01-S02 The shop recounts the basket');
    expect(one.querySelector('[data-meta="previous"]')).toBeNull();
    expect(within(one).getByRole('link', { name: /DM-JR01-S02/ })).toHaveAttribute('href', '/DM-JR01-S02');
    expect(two).toHaveTextContent('Step 1 of DM-JR02Fill a basket');
    await openApp('/DM-SHOP-UC01', { data: workspace() });
    await within(main()).findByText('A shopper adds an item.');
    expect(within(main()).queryByRole('list', { name: /is a step of/ })).toBeNull();
  });
});

describe('LA-V132-R07-T01 a policy names the journeys it is a handoff in, with its neighbors', () => {
  it('shows In journeys under the policy with the journey and its steps before and after as links', async () => {
    await openApp('/DM-SHOP-PO01', { data: withJourneys() });
    const fact = await within(main()).findByRole('list', { name: 'Journeys DM-SHOP-PO01 is a step of' });
    expect(fact).toHaveTextContent('Step 2 of DM-JR01Buy something');
    expect(within(fact).getByRole('link', { name: /DM-JR01-S01/ })).toBeInTheDocument();
    expect(within(fact).getByRole('link', { name: /DM-JR01-S03/ })).toBeInTheDocument();
  });
});

describe('LA-V110-R05-T01 an outcome\'s page lists the journeys that serve it with their proof, or says to write one', () => {
  it('lists the journey with its proof line under the measure, and for a duration nothing serves, the check', async () => {
    const data = withJourneys();
    data.problems.push({ severity: 'warning', check: 'outcome-duration-without-journey', record: 'DM-BO03', message: 'DM-BO03 reads as a duration and no journey serves it.' });
    addRows(data, 'business_outcome', { id: 'DM-BO03', title: 'Quick refunds', product_id: 'DM', statement: 'Refunds are quick.', measure: 'Median days from a refund asked to paid.', target: 'Under two days.' });
    await openApp('/DM-BO01', { data });
    const journeys = (await within(main()).findByRole('heading', { name: /^Journeys/ })).closest('section')!;
    expect(await within(journeys).findByText(/5 steps · \d proved/)).toBeInTheDocument();
    expect(within(journeys).getByRole('link', { name: /DM-JR01/ })).toHaveAttribute('href', '/DM-JR01');
    await openApp('/DM-BO03', { data });
    const none = (await within(main()).findByRole('heading', { name: /^Journeys/ })).closest('section')!;
    expect(none).toHaveTextContent('No journey serves it yet.');
    expect(within(none).getByRole('link', { name: 'outcome-duration-without-journey' })).toBeInTheDocument();
  });
});

describe('LA-V51-R13-T01 the product page\'s Discovery lists its journeys after its outcomes, with how many use cases are in one', () => {
  it('shows Discovery with the outcomes, then the journeys with their steps count and proof, then the count, none under Shared', async () => {
    await openApp('/DM', { data: withJourneys() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const discovery = section(/^Discovery/);
    const headings = within(discovery).getAllByRole('heading').map((h) => h.firstChild?.textContent);
    expect(headings).toEqual(['Discovery', 'Business outcomes', 'Journeys']);
    const cards = [...within(within(discovery).getByRole('list', { name: 'Journeys' })).getAllByRole('link').filter((a) => a.classList.contains('card-title'))];
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(['/DM-JR01', '/DM-JR02']);
    expect(await within(discovery).findByText(/5 steps · \d proved · 1 carrying out nothing yet/)).toBeInTheDocument();
    expect(within(discovery).getByText('Use cases in a journey: 2 of 2')).toBeInTheDocument();
    const order = within(main()).getAllByRole('heading', { level: 2 }).map((h) => h.firstChild?.textContent);
    expect(order.indexOf('Discovery')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('Discovery')).toBeLessThan(order.indexOf('Domains'));
    expect(main().querySelector('.product-shared .stage-discovery')).toBeNull();
    // The journey tests are Test plan records of the product: they stay under Shared, the journeys do not.
    expect(main().querySelector('.product-shared a[href="/DM-JR01"], .product-shared a[href="/DM-JR01-S01"]')).toBeNull();
  });

  it('adds a journey from the product\'s page through the aggregate\'s own Add, with the next free ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM', { data: withJourneys(), command: () => ({ answer: ok }) });
    await screen.findByRole('toolbar', { name: 'Change DM' });
    await chooseAdd(user, toolbar('DM'), 'Journey');
    const form = screen.getByRole('form', { name: 'Add a journey' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-JR03'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Return an item');
    await user.type(within(form).getByRole('textbox', { name: /^trigger/ }), 'A shopper wants to return an item.');
    await user.type(within(form).getByRole('textbox', { name: /^result/ }), 'The shopper has the money back.');
    await user.click(within(form).getByRole('button', { name: 'Add journey' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/journey/add-journey', input: { product_id: 'DM', id: 'DM-JR03', title: 'Return an item', trigger: 'A shopper wants to return an item.', result: 'The shopper has the money back.' } }]));
  });
});

describe('LA-V92-R78-T02 a record a journey reaches names the journey its outcome is served through', () => {
  it('marks the outcome via the journey on the Serves line', async () => {
    await openApp('/DM-PAY-UC01', { data: withJourneys() });
    const serves = await waitFor(() => {
      const found = main().querySelector('[data-fact="serves"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const list = within(serves).getByRole('list', { name: 'Outcomes DM-PAY-UC01 serves' });
    await waitFor(() => expect(list).toHaveTextContent('DM-BO01'));
    expect(within(list).getAllByRole('listitem')[0].querySelector('[data-meta="via"]')).toHaveTextContent('via DM-JR01');
  });

  it('shows no Serves line on a journey: its serves links are its own, in its header', async () => {
    await openApp('/DM-JR01', { data: withJourneys() });
    await within(main()).findByText('The shopper has paid for the basket.');
    expect(main().querySelector('.record-side [data-fact="serves"]')).toBeNull();
  });
});

describe('LA-V101-R04-T03 a flow\'s steps move up and down through the aggregate\'s own Move', () => {
  it('Move down on the first step of the main path sends Move a flow step with its neighbor\'s position', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-UC01-FL', { data: setRow(workspace(), 'flow_step', 'DM-SHOP-UC01-FL-S01', {}), command: () => ({ answer: ok }) });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.queryByRole('button', { name: 'Move up DM-SHOP-UC01-FL-S01' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Move down DM-SHOP-UC01-FL-S01' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/move-flow-step', input: { id: 'DM-SHOP-UC01-FL-S01', position: 2 } }]));
  });
});
