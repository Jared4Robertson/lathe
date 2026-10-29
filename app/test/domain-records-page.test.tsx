import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DOMAIN_COMMANDS } from '../../lathe/src/authoring/domain/commands/index';
import type { DomainCommands } from '../src/authoring/domain/commands';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Domain records page and its editor (LA-AUT-A4, LA-V120): a domain and every record in it are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with an outcome its capability serves, a domain service with its service and test, and a repository. */
function withDomain(): SpecData {
  const w = workspace();
  addRows(w, 'business_outcome', { id: 'DM-BO01', title: 'More baskets checked out', product_id: 'DM', statement: 'More baskets are checked out.', measure: 'Baskets checked out each week.', target: 'Two in three.' });
  addRows(w, 'serves', { source_id: 'DM-SHOP-CAP01', target_id: 'DM-BO01' });
  addRows(w, 'domain_service', { id: 'DM-SHOP-DS01', title: 'Basket total', domain_id: 'DM-SHOP', statement: 'The total of a basket is the sum of its lines.' });
  addRows(w, 'service', { id: 'DM-SHOP-DS01-SV', title: 'basketTotal', domain_service_id: 'DM-SHOP-DS01', file: 'src/total.ts' });
  addRows(w, 'domain_service_test', { id: 'DM-SHOP-DS01-T01', title: 'Two lines add up', domain_service_id: 'DM-SHOP-DS01', level: 'unit', state: 'automated', file: 'test/total.test.ts', when: 'A basket has two lines.', then: 'Its total is their sum.' });
  addRows(w, 'repository', { id: 'DM-SHOP-REPO01', title: 'BasketRepository', domain_id: 'DM-SHOP', file: 'src/baskets.ts', description: 'Loads and saves baskets.' });
  addRows(w, 'persists', { source_id: 'DM-SHOP-REPO01', target_id: 'DM-SHOP-A1' });
  addRows(w, 'package_use', { record_id: 'DM-SHOP-REPO01', package: 'duckdb' });
  addRows(w, 'repository_share', { repository_id: 'DM-SHOP-REPO01', aggregate_id: 'DM-PAY-A1', reason: 'Payments are kept with their baskets.' });
  return w;
}

describe('LA-V120-R01-T01 a domain\'s records are read through the Domain aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/domain/get-domain for a capability, and shows its description, position and use cases', async () => {
    const { requests } = await openApp('/DM-SHOP-CAP01', { data: withDomain() });
    expect(await within(main()).findByText('The fixture\'s capability Buying.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/domain/get-domain?id=DM-SHOP-CAP01');
    const useCases = within(main()).getByRole('heading', { name: /^Use cases/ }).closest('section')!;
    expect([...useCases.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-UC01']);
  });

  it('shows a domain service with its service and tests, and a repository with the aggregates it also persists', async () => {
    await openApp('/DM-SHOP-DS01', { data: withDomain() });
    expect(await within(main()).findByText('The total of a basket is the sum of its lines.')).toBeInTheDocument();
    const service = within(main()).getByRole('heading', { name: /^Service/ }).closest('section')!;
    expect(within(service).getByRole('link', { name: /DM-SHOP-DS01-SV/ })).toBeInTheDocument();
    const tests = within(main()).getByRole('heading', { name: /^Domain service tests/ }).closest('section')!;
    expect(within(tests).getByRole('link', { name: /DM-SHOP-DS01-T01/ })).toBeInTheDocument();

    await openApp('/DM-SHOP-REPO01', { data: withDomain() });
    expect(await within(main()).findByText('Loads and saves baskets.')).toBeInTheDocument();
    expect(within(main()).getByRole('heading', { name: /^Also persists/ }).closest('section')).toHaveTextContent('Payments are kept with their baskets.');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof DomainCommands)[] = [
      '/api/domain/add-capability', '/api/domain/add-domain-service-test', '/api/domain/add-domain-service', '/api/domain/add-domain', '/api/domain/add-repository', '/api/domain/add-service', '/api/domain/add-term',
      '/api/domain/change-capability', '/api/domain/change-domain-service-test', '/api/domain/change-domain-service', '/api/domain/change-domain', '/api/domain/change-repository', '/api/domain/change-service', '/api/domain/change-term',
      '/api/domain/remove-capability', '/api/domain/remove-domain-service-test', '/api/domain/remove-domain-service', '/api/domain/remove-domain', '/api/domain/remove-repository', '/api/domain/remove-service', '/api/domain/remove-term',
    ];
    expect([...routes].sort()).toEqual(DOMAIN_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V120-R02-T01 the Domain editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a term with only what changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withDomain(), 'term', 'DM-SHOP-TM01', { meaning: 'What a shopper fills before paying.' });
    const { commands, writes } = await openApp('/DM-SHOP-TM01', { data: withDomain(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-SHOP-TM01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-TM01' });
    const meaning = within(form).getByRole('textbox', { name: /^meaning/ });
    await user.clear(meaning);
    await user.type(meaning, 'What a shopper fills before paying.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/domain/change-term', input: { id: 'DM-SHOP-TM01', meaning: 'What a shopper fills before paying.' } }]));
    expect(writes).toEqual([]);
    expect(await within(main()).findByText('What a shopper fills before paying.')).toBeInTheDocument();
  });

  it('the domain\'s page offers Add for its own kinds and for a test data set, through the aggregates\' own Adds', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/DM-SHOP', { data: withDomain(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-SHOP');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add capability', 'Add term', 'Add domain service', 'Add repository', 'Add entry point', 'Add open question', 'Add test data set', 'Add tooling', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Add repository' }));
    const form = screen.getByRole('form', { name: 'Add a repository' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-REPO02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'LineRepository');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Loads and saves lines.');
    await user.click(within(form).getByRole('button', { name: 'Add to Packages' }));
    await user.type(within(form).getByRole('textbox', { name: /^package 1/ }), 'duckdb');
    await user.click(within(form).getByRole('button', { name: 'Add repository' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/domain/add-repository', input: { domain_id: 'DM-SHOP', id: 'DM-SHOP-REPO02', title: 'LineRepository', description: 'Loads and saves lines.', packages: ['duckdb'] } }]));
    expect(writes).toEqual([]);
  });

  it('adds a test data set from the domain\'s page through the Test data set aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP', { data: withDomain(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-SHOP')).getByRole('button', { name: 'Add test data set' }));
    const form = screen.getByRole('form', { name: 'Add a test data set' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-TD01'));
    for (const [name, text] of [['title', 'An empty basket'], ['environment', 'A fresh store.'], ['records', 'One shopper.'], ['prepare', 'Seed it.'], ['reset', 'Drop it.'], ['description', 'A shopper with nothing in the basket.']]) {
      await user.type(within(form).getByRole('textbox', { name: new RegExp(`^${name}`) }), text);
    }
    await user.click(within(form).getByRole('button', { name: 'Add test data set' }));
    await waitFor(() => expect(commands.map((c) => c.route)).toEqual(['/api/test-data-set/add-test-data-set']));
    expect(commands[0].input).toMatchObject({ domain_id: 'DM-SHOP', id: 'DM-SHOP-TD01', title: 'An empty basket' });
  });
});

describe('LA-V120-R03-T01 a refused Domain command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a capability and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'capability', key: 'DM-SHOP-CAP01', message: 'Capability DM-SHOP-CAP01 is referenced, so it stays: use case DM-SHOP-UC01 sits under it' }] };
    const { commands } = await openApp('/DM-SHOP-CAP01', { data: withDomain(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-CAP01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-CAP01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-CAP01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('use case DM-SHOP-UC01 sits under it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/domain/remove-capability', input: { id: 'DM-SHOP-CAP01' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-CAP01');
  });

  it('a refused Change keeps the form open with what was entered and every reason at its top', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'required', table: 'domain_service', key: 'DM-SHOP-DS01', message: 'A domain service needs its statement' }] };
    const { commands } = await openApp('/DM-SHOP-DS01', { data: withDomain(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-DS01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-DS01' });
    await user.clear(within(form).getByRole('textbox', { name: /^statement/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('A domain service needs its statement');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/domain/change-domain-service', input: { id: 'DM-SHOP-DS01', statement: '' } }]);
    expect(within(form).getByRole('textbox', { name: /^statement/ })).toHaveValue('');
  });
});

describe('LA-V120-R04-T01 a capability lists the business outcomes it serves and its use cases', () => {
  it('lists Serves in its Traceability and its use cases in their own section', async () => {
    await openApp('/DM-SHOP-CAP01', { data: withDomain() });
    const trace = (await within(main()).findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
    expect(within(trace).getByRole('heading', { level: 3, name: /^Serves/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-BO01/ })).toBeInTheDocument();
    expect(within(main()).getByRole('heading', { name: /^Use cases/ })).toHaveTextContent(/1$/);
  });
});
