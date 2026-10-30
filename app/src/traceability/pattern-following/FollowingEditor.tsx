import { useState } from 'react';
import type { PatternPage } from '../../../../lathe/src/authoring/pattern/read-model';
import type { FollowingPage } from '../../../../lathe/src/traceability/pattern-following/read-model';
import { Button } from '../../components/Button';
import { addInput, changeInput, CommandForm, draftOf, emptyDraft, Fields, type Draft, type FieldSpec } from '../../edit/command-form';
import type { Choice } from '../../edit/fields';
import { useWriter } from '../../edit/write';
import { useAnnounce } from '../../shell/commands';
import { byIdOrder, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { sendPatternFollowing, type PatternFollowingCommands } from './commands';
import '../../edit/edit.css';

// The following's editor (LA-TRC-A3): the actions on a pattern's followers, each sending one of the Pattern following
// aggregate's own commands, POST /api/pattern-following/<command>, and nothing else. On each follower's row, Change
// values sends Change the setting values with the whole list, only when it changed, and Stop following asks first and
// sends Stop following a pattern; Follow, under the followers, makes a domain or use case of the pattern's product
// follow it with Follow a pattern, its settings' values given or left to give later. A refusal shows every reason the
// command gave, in its own words, keeps what was entered, and changes nothing.

/** What the editor shows: nothing, a follower's Change values or Stop following, or Follow. */
export type FollowingMode = { mode: 'view' } | { mode: 'change'; following: FollowingPage } | { mode: 'stop'; following: FollowingPage } | { mode: 'follow' };

/** The setting values, a list of the setting_value table's rows, as the forms give them. */
const VALUES: FieldSpec = {
  field: 'setting_values',
  label: 'Setting values',
  description: "Each of the pattern's settings with its value, or the reason it does not apply (not applicable).",
  table: 'setting_value',
  columns: ['setting', 'value', 'not_applicable'],
};

/** A following's values as the setting_value rows its form holds. */
const valuesOf = (following: FollowingPage) => ({
  setting_values: following.settings.map((s) => ({ setting: s.setting, value: s.value ?? undefined, not_applicable: s.notApplicable ?? undefined })),
});

/** The actions on one follower's row: Change values and Stop following, each opening its form under the followers. */
export function RowActions({ following, setMode }: { following: FollowingPage; setMode: (mode: FollowingMode) => void }) {
  if (!useWriter()) return null;
  return (
    <div className="record-actions" role="toolbar" aria-label={`Change the following of ${following.follower}`}>
      <Button icon="edit" onClick={() => setMode({ mode: 'change', following })}>Change values</Button>
      <Button icon="trash" danger onClick={() => setMode({ mode: 'stop', following })}>Stop following</Button>
    </div>
  );
}

/** Follow: the button that opens the form for a new follower of the pattern. */
export function FollowButton({ pattern, setMode }: { pattern: string; setMode: (mode: FollowingMode) => void }) {
  if (!useWriter()) return null;
  return (
    <div className="record-actions" role="toolbar" aria-label={`Followers of ${pattern}`}>
      <Button icon="plus" onClick={() => setMode({ mode: 'follow' })}>Follow</Button>
    </div>
  );
}

/** The form the mode opens: a follower's Change values or Stop following, or Follow. */
export function FollowingForm({ index, page, followers, mode, onDone }: { index: RecordIndex; page: PatternPage; followers: readonly string[]; mode: FollowingMode; onDone: () => void }) {
  if (mode.mode === 'change') return <ChangeValuesForm index={index} following={mode.following} onDone={onDone} />;
  if (mode.mode === 'stop') return <StopFollowingForm following={mode.following} onDone={onDone} />;
  if (mode.mode === 'follow') return <FollowForm index={index} page={page} followers={followers} onDone={onDone} />;
  return null;
}

/** Change values: the whole list of the follower's setting values, sent only when it changed. */
function ChangeValuesForm({ index, following, onDone }: { index: RecordIndex; following: FollowingPage; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const current = valuesOf(following);
  const [draft, setDraft] = useState<Draft>(() => draftOf([VALUES], current));
  const submit = async () => {
    const input = changeInput(index, [VALUES], draft, current, { follower_id: following.follower, pattern_id: following.pattern }, []);
    if (Object.keys(input).length === 2) { announce('Nothing changed'); onDone(); return null; }
    const route = '/api/pattern-following/change-setting-values';
    const answer = await sendPatternFollowing(writer, route, input as unknown as PatternFollowingCommands[typeof route]);
    if (answer.ok) { announce(`Saved the values ${following.follower} gives`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`${following.follower} follows ${following.pattern}`} title={`Change the values ${following.follower} gives`} submit={submit} saveLabel="Save" onCancel={onDone}>
      {(first) => <Fields index={index} specs={[VALUES]} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}

/** Stop following: asks first, saying the values go with the following, and sends Stop following a pattern. */
function StopFollowingForm({ following, onDone }: { following: FollowingPage; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const { follower, pattern } = following;
  const submit = async () => {
    const answer = await sendPatternFollowing(writer, '/api/pattern-following/stop-following-pattern', { follower_id: follower, pattern_id: pattern });
    if (answer.ok) { announce(`${follower} no longer follows ${pattern}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`${follower} follows ${pattern}`} title={`Stop ${follower} following ${pattern}`} submit={submit} saveLabel="Stop following" onCancel={onDone}>
      {() => <p>{follower} stops following {pattern}, and the {following.settings.length === 1 ? 'value' : 'values'} it gives the pattern's settings go with it.</p>}
    </CommandForm>
  );
}

/** Follow: a domain or use case of the pattern's product that does not follow it yet, with a row for each of its settings. */
function FollowForm({ index, page, followers, onDone }: { index: RecordIndex; page: PatternPage; followers: readonly string[]; onDone: () => void }) {
  const writer = useWriter()!;
  const announce = useAnnounce();
  const pattern = page.pattern.id;
  const following = new Set(followers);
  const choices: Choice[] = [...index.byId.values()]
    .filter((r) => (r.kind === 'domain' || r.kind === 'use_case') && r.product === page.pattern.product_id && !following.has(r.id))
    .sort(byIdOrder)
    .map((r) => ({ id: r.id, title: r.title }));
  const specs: FieldSpec[] = [
    { field: 'follower_id', label: 'Follower', description: 'The domain or use case that follows the pattern.', one: choices, required: true },
    VALUES,
  ];
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), parts: { setting_values: page.settings.map((s) => ({ setting: s.name, value: '', not_applicable: '' })) } }));
  const submit = async () => {
    const input = addInput(index, specs, draft, { pattern_id: pattern });
    const route = '/api/pattern-following/follow-pattern';
    const answer = await sendPatternFollowing(writer, route, input as unknown as PatternFollowingCommands[typeof route]);
    if (answer.ok) { announce(`${String(input.follower_id)} follows ${pattern}`); onDone(); }
    return answer;
  };
  return (
    <CommandForm eyebrow={`New follower of ${pattern}`} title={`Follow ${pattern}`} submit={submit} saveLabel="Follow" onCancel={onDone}>
      {(first) => <Fields index={index} specs={specs} draft={draft} setDraft={setDraft} first={first} />}
    </CommandForm>
  );
}
