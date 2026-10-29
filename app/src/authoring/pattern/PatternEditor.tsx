import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PatternKind } from '../../../../lathe/src/authoring/pattern/model';
import type { PatternPage, SettingOnPage } from '../../../../lathe/src/authoring/pattern/read-model';
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, RemoveQuestion, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter, type Writer } from '../../edit/write';
import { navigate } from '../../router';
import { useAnnounce } from '../../shell/commands';
import type { SpecIndex } from '../../specs/data';
import { addressOf } from '../../views/address';
import { sendPattern, type PatternCommands, type PatternRoute } from './commands';
import { useNextPatternId } from './reads';
import '../../edit/edit.css';

// The Pattern editor (LA-AUT-A2): the actions on a record of a pattern, each sending one of the aggregate's own
// commands, POST /api/pattern/<command>, and nothing else. Edit sends its kind's Change with only what changed; Add
// opens an empty form for the kind that sits under the record (a rule under the pattern, a test under a rule), with
// the next free ID read from the aggregate (next-id), and sends its Add; Remove says what goes with the record and
// sends its Remove. The aggregate has no Move. A pattern is added from its product's page (AddPatternForm). A
// refusal shows every reason the command gave, in its own words, keeps what was entered, and changes nothing.

/** A kind's label in a sentence. */
const LABEL: Record<PatternKind, string> = { pattern: 'pattern', pattern_rule: 'pattern rule', pattern_rule_test: 'pattern rule test' };

/** The kind added under a record of each kind, inside the pattern. */
const ADDED_UNDER: Record<PatternKind, Exclude<PatternKind, 'pattern'> | null> = { pattern: 'pattern_rule', pattern_rule: 'pattern_rule_test', pattern_rule_test: null };

/** The test data sets of the product, as what a test may start from. */
const dataSets = (index: SpecIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'test_data_set' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The domains of the product, as where a rule test proves its rule. */
const domains = (index: SpecIndex, product: string): Choice[] =>
  [...index.byId.values()].filter((r) => r.kind === 'domain' && r.product === product).map((r) => ({ id: r.id, title: r.title }));

/** The fields each kind's Add and Change take (Change leaves out the ID), in their input's order. */
function fieldsOf(index: SpecIndex, product: string, settings: readonly SettingOnPage[], kind: PatternKind, adding: boolean): FieldSpec[] {
  const id = (table: string): FieldSpec[] => (adding ? [{ field: 'id', column: 'id', table }] : []);
  switch (kind) {
    case 'pattern':
      return [
        ...id('pattern'),
        { field: 'title', column: 'title', table: 'pattern' },
        { field: 'description', column: 'description', table: 'pattern', long: true },
        { field: 'notes', column: 'notes', table: 'pattern', long: true },
        { field: 'settings', label: 'Settings', description: 'What each follower decides, in order: each a name and its meaning. The list replaces the pattern\'s settings.', table: 'pattern_setting', columns: ['name', 'meaning'] },
      ];
    case 'pattern_rule':
      return [
        ...id('pattern_rule'),
        { field: 'title', column: 'title', table: 'pattern_rule' },
        { field: 'statement', column: 'statement', table: 'pattern_rule', long: true },
        { field: 'group_name', column: 'group_name', table: 'pattern_rule' },
        { field: 'setting', label: 'Setting', description: 'The setting of its pattern the rule depends on, if any.', one: settings.map((s) => ({ id: s.name, title: s.meaning })) },
        { field: 'notes', column: 'notes', table: 'pattern_rule', long: true },
      ];
    case 'pattern_rule_test': {
      const table = 'pattern_rule_test';
      return [
        ...id(table),
        { field: 'title', column: 'title', table },
        { field: 'domain_id', label: 'Domain', description: 'The following domain it proves the rule in.', one: domains(index, product), required: true },
        { field: 'when', column: 'when', table, long: true },
        { field: 'then', column: 'then', table, long: true },
        { field: 'level', column: 'level', table },
        { field: 'state', column: 'state', table },
        { field: 'file', column: 'file', table },
        { field: 'manual_reason', column: 'manual_reason', table, long: true },
        { field: 'size', column: 'size', table },
        { field: 'smoke', column: 'smoke', table },
        { field: 'external', column: 'external', table },
        { field: 'notes', column: 'notes', table, long: true },
        { field: 'starts_from', label: 'Starts from', description: 'The test data sets it starts from.', many: dataSets(index, product) },
      ];
    }
  }
}

/** The record's current values, by its input's field names: its row's columns and the links it starts. */
function currentOf(page: PatternPage, kind: PatternKind, id: string): Record<string, unknown> {
  switch (kind) {
    case 'pattern':
      return { ...page.pattern, settings: page.settings };
    case 'pattern_rule':
      return { ...page.rules.find((r) => r.rule.id === id)!.rule };
    case 'pattern_rule_test': {
      const test = page.rules.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return { ...test.test, starts_from: test.startsFrom };
    }
  }
}

/** Each kind's Change command, and the fields it may clear with null. */
const CHANGE: Record<PatternKind, { route: PatternRoute; clearable: readonly string[] }> = {
  pattern: { route: '/api/pattern/change-pattern', clearable: ['notes'] },
  pattern_rule: { route: '/api/pattern/change-pattern-rule', clearable: ['group_name', 'setting', 'notes'] },
  pattern_rule_test: { route: '/api/pattern/change-pattern-rule-test', clearable: ['file', 'manual_reason', 'size', 'smoke', 'external', 'notes'] },
};

/** Each kind's Add command, and the field that names its parent. */
const ADD: Record<PatternKind, { route: PatternRoute; parent: string }> = {
  pattern: { route: '/api/pattern/add-pattern', parent: 'product_id' },
  pattern_rule: { route: '/api/pattern/add-pattern-rule', parent: 'pattern_id' },
  pattern_rule_test: { route: '/api/pattern/add-pattern-rule-test', parent: 'pattern_rule_id' },
};

/** Each kind's Remove command. */
const REMOVE: Record<PatternKind, PatternRoute> = {
  pattern: '/api/pattern/remove-pattern',
  pattern_rule: '/api/pattern/remove-pattern-rule',
  pattern_rule_test: '/api/pattern/remove-pattern-rule-test',
};

/** Sends a command whose input this form has built to its kind's shape: the route names the type it takes. */
const send = (writer: Writer, route: PatternRoute, input: Record<string, unknown>): Promise<WriteAnswer> => sendPattern(writer, route, input as unknown as PatternCommands[typeof route]);

/** What goes with a record when it is removed, inside the pattern: what sits under it. */
function goesWith(page: PatternPage, kind: PatternKind, id: string): string[] {
  if (kind === 'pattern') return page.rules.flatMap((r) => [r.rule.id, ...r.tests.map((t) => t.test.id)]);
  if (kind === 'pattern_rule') return page.rules.find((r) => r.rule.id === id)!.tests.map((t) => t.test.id);
  return [];
}

/** The record a removed one's page gives way to: what it sits under. */
function parentOf(page: PatternPage, kind: PatternKind, id: string): string {
  if (kind === 'pattern') return page.pattern.product_id;
  if (kind === 'pattern_rule') return page.pattern.id;
  return page.rules.find((r) => r.tests.some((t) => t.test.id === id))!.rule.id;
}

type Mode = { mode: 'view' } | { mode: 'change' } | { mode: 'add'; kind: Exclude<PatternKind, 'pattern'> } | { mode: 'remove' };

/** A record of the pattern with its actions; a form or the remove question shows in place of its page. */
export function PatternEditor({ index, page, children }: { index: SpecIndex; page: PatternPage; children: ReactNode }) {
  const writer = useWriter();
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>({ mode: 'view' });
  const toolbar = useRef<HTMLDivElement>(null);
  const { id, kind } = page.record;
  useEffect(() => { setMode({ mode: 'view' }); }, [id]);
  if (!writer) return <>{children}</>;
  const back = () => {
    setMode({ mode: 'view' });
    setTimeout(() => toolbar.current?.querySelector<HTMLElement>('button')?.focus(), 0);
  };
  const product = page.pattern.product_id;
  if (mode.mode === 'change') {
    const specs = fieldsOf(index, product, page.settings, kind, false);
    const current = currentOf(page, kind, id);
    const submit = async (draft: Draft) => {
      const input = changeInput(index, specs, draft, current, { id }, CHANGE[kind].clearable);
      if (Object.keys(input).length === 1) { announce('Nothing changed'); back(); return null; }
      const answer = await send(writer, CHANGE[kind].route, input);
      if (answer.ok) { announce(`Saved ${id}`); back(); }
      return answer;
    };
    return <div className="spec-body"><ChangeForm index={index} specs={specs} current={current} eyebrow={LABEL[kind]} id={id} submit={submit} onDone={back} /></div>;
  }
  if (mode.mode === 'add') return <div className="spec-body"><AddForm index={index} product={product} settings={page.settings} kind={mode.kind} parent={id} onDone={back} /></div>;
  const adds = ADDED_UNDER[kind];
  return (
    <>
      <div className="record-actions" role="toolbar" aria-label={`Change ${id}`} ref={toolbar}>
        <Button icon="edit" onClick={() => setMode({ mode: 'change' })}>Edit</Button>
        {adds && <Button icon="plus" onClick={() => setMode({ mode: 'add', kind: adds })}>Add {LABEL[adds]}</Button>}
        <Button icon="trash" danger onClick={() => setMode({ mode: 'remove' })} aria-expanded={mode.mode === 'remove'}>Remove</Button>
      </div>
      {mode.mode === 'remove' && (
        <RemoveQuestion index={index} id={id} label={LABEL[kind]} goes={goesWith(page, kind, id)} then={addressOf(parentOf(page, kind, id))} onCancel={back}
          remove={() => sendPattern(writer, REMOVE[kind], { id })} />
      )}
      {children}
    </>
  );
}

/** Edit: the record's Change, with only what changed. */
function ChangeForm({ index, specs, current, eyebrow, id, submit, onDone }: {
  index: SpecIndex;
  specs: FieldSpec[];
  current: Record<string, unknown>;
  eyebrow: string;
  id: string;
  submit: (draft: Draft) => Promise<WriteAnswer | null>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(specs, current));
  return (
    <CommandForm eyebrow={eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1)} title={`Edit ${id}`} submit={() => submit(draft)} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Add: an empty form for a rule or rule test under the record, its ID the next free one, sent as that kind's Add. */
function AddForm({ index, product, settings, kind, parent, onDone }: { index: SpecIndex; product: string; settings: readonly SettingOnPage[]; kind: Exclude<PatternKind, 'pattern'>; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const next = useNextPatternId(kind, parent, index);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (next.state === 'read') setDraft((d) => (d.text.id ? d : { ...d, text: { ...d.text, id: next.answer } }));
  }, [next]);
  const specs = fieldsOf(index, product, settings, kind, true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { [ADD[kind].parent]: parent });
    const answer = await send(writer, ADD[kind].route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New ${LABEL[kind]} under ${parent}`} title={`Add a ${LABEL[kind]}`} submit={submit} saveLabel={`Add ${LABEL[kind]}`} onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/**
 * Add a pattern to a product (from the product's page): the aggregate's own Add. A pattern's ID is its product's,
 * PAT and a name chosen for it, so the form starts it with the product's prefix and leaves the name to the person.
 */
export function AddPatternForm({ index, parent, onDone }: { index: SpecIndex; parent: string; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), text: { id: `${parent}-PAT-` } }));
  const specs = fieldsOf(index, parent, [], 'pattern', true);
  const submit = async () => {
    const input = addInput(index, specs, draft, { product_id: parent });
    const answer = await send(writer, ADD.pattern.route, input);
    if (answer.ok) { announce(`Added ${String(input.id)}`); navigate(addressOf(String(input.id))); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New pattern under ${parent}`} title="Add a pattern" submit={submit} saveLabel="Add pattern" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
