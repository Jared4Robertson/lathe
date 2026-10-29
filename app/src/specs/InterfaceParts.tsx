import type { ReactNode } from 'react';
import { LongList } from '../components/LongList';
import { addressOf } from '../views/address';
import type { SpecIndex, SpecRecord } from './data';
import { ProblemBadge, RecordLink, Section, recordText } from './parts';

// A use case happens through one or more of its product's interfaces, with one flow for each (LA-V92-R78): an
// interface's page lists the flows through it by capability, then use case, and the product's use cases that have no
// flow through it yet, worked out from the flows' interface and parent, never stored twice. A use case's page names
// each flow's interface (app/src/authoring/use-case).

/** The flows of a use case, by interface ID. */
const flowsOf = (index: SpecIndex, useCase: string) =>
  (index.children.get(useCase) ?? []).filter((c) => c.kind === 'flow').sort((a, b) => String(a.row.interface_id).localeCompare(String(b.row.interface_id)));

/** Whether an interface's name already says its kind (a CLI named CLI, an API named HTTP API). */
export const saysKind = (iface: SpecRecord) => iface.title.toLowerCase().includes(String(iface.row.kind ?? '').toLowerCase());

/** The product's capabilities, by domain then place, each with its use cases by ID. */
function capabilitiesOf(index: SpecIndex, product: string): { capability: SpecRecord; useCases: SpecRecord[] }[] {
  return [...index.byId.values()]
    .filter((r) => r.kind === 'capability' && r.product === product)
    .sort((a, b) => String(a.domain).localeCompare(String(b.domain)) || Number(a.row.position) - Number(b.row.position))
    .map((capability) => ({
      capability,
      useCases: (index.children.get(capability.id) ?? []).filter((c) => c.kind === 'use_case').sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    }));
}

function ByCapability({ groups, label, render }: {
  groups: { capability: SpecRecord; items: SpecRecord[] }[];
  label: string;
  render: (r: SpecRecord) => ReactNode;
}) {
  return (
    <>
      {groups.map(({ capability, items }) => (
        <Section key={capability.id} title={capability.title} titleTo={addressOf(capability.id)} count={items.length} level={3} className="record-group">
          <LongList
            label={`${label}: ${capability.title}`}
            className="record-list"
            items={items}
            itemKey={(r) => r.id}
            searchText={recordText}
            render={render}
          />
        </Section>
      ))}
    </>
  );
}

/** An interface's page: the flows through it by capability and use case, and the use cases with no flow through it. */
export function InterfaceFlows({ index, iface }: { index: SpecIndex; iface: SpecRecord }) {
  const capabilities = capabilitiesOf(index, String(iface.row.product_id));
  const through = (useCase: SpecRecord) => flowsOf(index, useCase.id).find((f) => f.row.interface_id === iface.id);
  const flows = capabilities
    .map(({ capability, useCases }) => ({ capability, items: useCases.flatMap((u) => through(u) ?? []) }))
    .filter((g) => g.items.length > 0);
  const missing = capabilities
    .map(({ capability, useCases }) => ({ capability, items: useCases.filter((u) => !through(u)) }))
    .filter((g) => g.items.length > 0);
  const count = (groups: { items: SpecRecord[] }[]) => groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <Section title="Flows through it" count={count(flows)} className="interface-flows">
        {flows.length === 0 ? <p className="hint">No flow goes through this interface yet.</p> : (
          <ByCapability groups={flows} label={`Flows through ${iface.id}`} render={(flow) => (
            <div className="record-row">
              <RecordLink index={index} id={flow.id} row />
              <span className="row-tags">
                <small className="meta" data-meta="use-case">{index.byId.get(flow.parent ?? '')?.title ?? flow.parent}</small>
                <ProblemBadge problems={index.problemsFor.get(flow.id) ?? []} />
              </span>
            </div>
          )} />
        )}
      </Section>
      <Section title="Use cases with no flow through it" count={count(missing)} className="interface-missing">
        {missing.length === 0 ? <p className="hint">Every use case has a flow through this interface.</p> : (
          <ByCapability groups={missing} label={`Use cases with no flow through ${iface.id}`} render={(useCase) => (
            <div className="record-row">
              <RecordLink index={index} id={useCase.id} row />
            </div>
          )} />
        )}
      </Section>
    </>
  );
}
