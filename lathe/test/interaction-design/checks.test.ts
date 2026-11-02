// Lathe's checks of the Interaction design domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, loadData, ofCheck, removeData, without } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

const ofKind = (kind: string) => changing(complete(), 'interface', () => true, { kind });
/** The complete product with a second interface, a CLI that offers the first use case and has no command of its own. */

const withCli = () =>
  adding(complete(), {
    interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'CLI', description: 'The command line the librarian runs.', public: false }],
    offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC01' }],
  });

const unreached = (step: string, operation: string, interface_: string, kind: string, wants: string) => ({
  severity: 'warning', check: 'step-unreached', record: step,
  message: `Flow step ${step} invokes ${operation}, but ${interface_}, an interface of kind ${kind} that offers its use case, has no ${wants}; add one, or make the step a variant of the interfaces that reach it.`,
});

check('step-unreached', () => {
  it('LA-UCS-UC06-R09-T02 an interface that offers a use case reaches what each of its steps invokes: a web app or desktop through a view that presents it, an API through an endpoint, a CLI or agent tools through a record of the product\'s own; else the step is reported', async () => {
    expect(ofCheck(clean, 'step-unreached')).toEqual([]);
    // A web app or desktop: a view presents the command or query.
    const bare = await loadData(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-QRY01'));
    expect(ofCheck(bare, 'step-unreached')).toEqual([unreached('EX-LEND-UC01-FL-S02', 'EX-LEND-QRY01', 'EX-IF01', 'web app', 'view that presents it')]);
    const desktop = await loadData(changing(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-CMD02'), 'interface', () => true, { kind: 'desktop' }));
    expect(ofCheck(desktop, 'step-unreached')).toEqual([unreached('EX-LEND-UC02-FL-S01', 'EX-LEND-CMD02', 'EX-IF01', 'desktop', 'view that presents it')]);
    // A view of another interface does not reach it.
    const elsewhere = await loadData(adding(complete(), { interface: [{ id: 'EX-IF02', title: 'Desk', product_id: 'EX', kind: 'desktop', description: 'The desk app.', public: false }] }));
    expect(ofCheck(elsewhere, 'step-unreached')).toEqual([]);
    const own = await loadData(changing(without(complete(), 'presents', (l) => l.target_id === 'EX-LEND-QRY01'), 'view', () => true, { interface_id: 'EX-IF01' }));
    expect(ofCheck(own, 'step-unreached').map((p) => p.record)).toEqual(['EX-LEND-UC01-FL-S02']);
    const theirs = await loadData(adding(changing(complete(), 'view', () => true, { interface_id: 'EX-IF02' }), { interface: [{ id: 'EX-IF02', title: 'Desk', product_id: 'EX', kind: 'desktop', description: 'The desk app.', public: false }] }));
    expect(ofCheck(theirs, 'step-unreached').map((p) => p.record)).toEqual(['EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-UC02-FL-S01']);
    // An API: an endpoint exposes it. Only the command has one.
    expect(ofCheck(await loadData(ofKind('API')), 'step-unreached')).toEqual([
      unreached('EX-LEND-UC01-FL-S02', 'EX-LEND-QRY01', 'EX-IF01', 'API', 'endpoint that exposes it'),
      unreached('EX-LEND-UC02-FL-S01', 'EX-LEND-CMD02', 'EX-IF01', 'API', 'endpoint that exposes it'),
    ]);
    // A CLI or agent tools: a record of the product's own interaction design kinds under it. None here.
    for (const kind of ['CLI', 'agent tools']) {
      expect(ofCheck(await loadData(ofKind(kind)), 'step-unreached').map((p) => p.record), kind).toEqual(['EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-UC02-FL-S01']);
    }
    // An interface of kind other reaches its operations in a way no record says.
    expect(ofCheck(await loadData(ofKind('other')), 'step-unreached')).toEqual([]);
    // Each interface that offers the use case is held to it, but a variant of another interface is not.
    expect(ofCheck(await loadData(withCli()), 'step-unreached').map((p) => [p.record, p.message.includes('EX-IF02')])).toEqual([['EX-LEND-UC01-FL-S01', true], ['EX-LEND-UC01-FL-S02', true]]);
    const variants = changing(withCli(), 'flow_step', (r) => String(r.id).startsWith('EX-LEND-UC01-FL-S'), { interface_id: 'EX-IF01' });
    expect(ofCheck(await loadData(variants), 'step-unreached')).toEqual([]);
  });
});

check('variant-not-offered', () => {
  it('LA-UCS-UC06-R09-T03 a step that is a variant of an interface that does not offer its use case is an error', async () => {
    expect(ofCheck(clean, 'variant-not-offered')).toEqual([]);
    const data = adding(complete(), { interface: [{ id: 'EX-IF02', title: 'CLI', product_id: 'EX', kind: 'other', description: 'The command line the librarian runs.', public: false }] });
    const variant = changing(data, 'flow_step', (r) => r.id === 'EX-LEND-UC01-FL-S01', { interface_id: 'EX-IF02' });
    expect(ofCheck(await loadData(variant), 'variant-not-offered')).toEqual([
      {
        severity: 'error', check: 'variant-not-offered', record: 'EX-LEND-UC01-FL-S01',
        message: 'Flow step EX-LEND-UC01-FL-S01 is a variant of EX-IF02, which does not offer its use case EX-LEND-UC01; offer it there, or name an interface that does.',
      },
    ]);
    const offered = adding(variant, { offers: [{ source_id: 'EX-IF02', target_id: 'EX-LEND-UC01' }] });
    expect(ofCheck(await loadData(offered), 'variant-not-offered')).toEqual([]);
  });
});

check('flow-not-offered', () => {
  it('LA-UCS-UC06-R09-T04 a use case with a flow that no interface offers is a warning', async () => {
    expect(ofCheck(clean, 'flow-not-offered')).toEqual([]);
    const ws = await loadData(without(complete(), 'offers', (l) => l.target_id === 'EX-LEND-UC02'));
    expect(ofCheck(ws, 'flow-not-offered')).toEqual([
      {
        severity: 'warning', check: 'flow-not-offered', record: 'EX-LEND-UC02',
        message: 'Use case EX-LEND-UC02 has a flow, EX-LEND-UC02-FL, but no interface offers it; offer it through the interfaces it happens through.',
      },
    ]);
  });
});

check('interface-actor-not-the-use-case', () => {
  it('LA-UCS-UC06-R09-T05 an interface that lists roles and offers a use case none of whose actors is among them is a warning', async () => {
    expect(ofCheck(clean, 'interface-actor-not-the-use-case')).toEqual([]);
    // The interface lists only the Librarian, but Borrow a tool is the Member's.
    const only = without(complete(), 'interface_actor', (r) => r.role_name === 'Member');
    expect(ofCheck(await loadData(only), 'interface-actor-not-the-use-case')).toEqual([
      {
        severity: 'warning', check: 'interface-actor-not-the-use-case', record: 'EX-IF01',
        message: "Interface EX-IF01 offers EX-LEND-UC01, but none of its roles (Librarian) is one of the use case's actors.",
      },
    ]);
    // An interface that lists no role is open to every actor.
    expect(ofCheck(await loadData(without(complete(), 'interface_actor', () => true)), 'interface-actor-not-the-use-case')).toEqual([]);
  });
});
