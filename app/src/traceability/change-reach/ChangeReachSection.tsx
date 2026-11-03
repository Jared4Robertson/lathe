import { Fragment } from 'react';
import { LongList } from '../../components/LongList';
import { type RecordIndex, type RecordSummary } from '../../exploring/record-summaries/record-index';
import { addressOf, withStage } from '../../views/address';
import { RecordLink, RecordRowBody, Section, SpecLink, idText } from '../../specs/parts';
import type { ReachHop, ReachRecord } from '../../../../lathe/src/traceability/change-reach/read-model';
import { setReachLight } from './light';
import { useChangeReach } from './reads';

// A record's Change reach section (LA-TRC-UC24): before the record is changed, everything the change would touch, as
// get-reach works it out: a line saying how many records, with a way to light them on the Graph; then each
// stage's records with their count, each a whole-row link with the path of links that reaches it (a test with its
// state, a technical record with its file); the files the change touches; and the use cases, journeys and business
// outcomes it could break. The product has none: its reach is everything.

/** The path read from the record reached back to the changed record: "fulfills LA-X-R01", "sits under LA-X-EP01, which sits under LA-X-CMD01". */
function PathWords({ index, path }: { index: RecordIndex; path: ReachHop[] }) {
  const hops = path.slice(1).reverse();
  return (
    <span className="reach-path" data-meta="path">
      {hops.map((h, i) => (
        <Fragment key={`${h.id}-${i}`}>
          {i > 0 && ', which '}
          {h.via?.toLowerCase()} <RecordLink index={index} id={i + 1 < hops.length ? hops[i + 1].id : path[0].id} showTitle={false} />
        </Fragment>
      ))}
    </span>
  );
}

function ReachRow({ index, reached }: { index: RecordIndex; reached: ReachRecord }) {
  const record = index.byId.get(reached.id);
  return (
    <div className="trace-row reach-row" data-reached={reached.id}>
      {record ? <RecordRowBody index={index} record={record} showKind /> : <RecordLink index={index} id={reached.id} row />}
      <PathWords index={index} path={reached.path} />
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ChangeReachSection({ index, record }: { index: RecordIndex; record: RecordSummary }) {
  const shown = record.kind !== 'product';
  const read = useChangeReach(shown ? record.id : null, index);
  if (!shown || read.state !== 'read' || read.answer.changed[0] !== record.id) return null;
  const reach = read.answer;
  const { useCases, journeys, outcomes } = reach.purposes;
  const purposes = [
    { label: 'Use cases', ids: useCases },
    { label: 'Journeys', ids: journeys },
    { label: 'Business outcomes', ids: outcomes },
  ].filter((p) => p.ids.length > 0);
  return (
    <Section title="Change reach" count={reach.count} className="change-reach">
      <p className="reach-summary">
        {reach.count === 0 ? 'Changing it touches no other record.' : `Changing it touches ${plural(reach.count, 'record')}${reach.files.length ? ` and ${plural(reach.files.length, 'file')}` : ''}.`}{' '}
        <SpecLink to={withStage(addressOf(record.id), 'graph')} className="reach-light" onClick={() => setReachLight(true)}>Light on the Graph</SpecLink>
      </p>
      {reach.groups.map((g) => (
        <Section key={g.stage ?? 'none'} title={g.label} count={g.records.length} level={3} className="trace-group reach-group">
          <LongList
            label={`${g.label} the change touches`}
            className="record-list trace-list"
            items={g.records}
            itemKey={(r) => r.id}
            searchText={(r) => idText(index, r.id)}
            render={(r) => <ReachRow index={index} reached={r} />}
          />
        </Section>
      ))}
      {reach.files.length > 0 && (
        <Section title="Files" count={reach.files.length} level={3} className="trace-group reach-files">
          <LongList
            label="Files the change touches"
            className="plain reach-file-list"
            items={reach.files}
            itemKey={(f) => f.path}
            searchText={(f) => `${f.path} ${f.records.join(' ')}`}
            render={(f) => (
              <div className="reach-file">
                <code>{f.path}</code>
                <span className="trace-cell">{f.records.map((id) => <RecordLink key={id} index={index} id={id} showTitle={false} />)}</span>
              </div>
            )}
          />
        </Section>
      )}
      <Section title="Purposes" level={3} className="trace-group reach-purposes">
        {purposes.length === 0 ? (
          <p className="hint">No use case reaches it, so no purpose rests on it.</p>
        ) : (
          purposes.map((p) => (
            <Section key={p.label} title={p.label} count={p.ids.length} level={4} className="reach-purpose">
              <LongList
                label={`${p.label} the change could break`}
                className="record-list trace-list"
                items={p.ids}
                itemKey={(id) => id}
                searchText={(id) => idText(index, id)}
                render={(id) => <RecordLink index={index} id={id} row />}
              />
            </Section>
          ))
        )}
      </Section>
    </Section>
  );
}
