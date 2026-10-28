import type { ReactNode } from 'react';
import { LongList } from '../components/LongList';
import { addressOf } from '../views/address';
import type { SpecIndex, SpecRecord } from './data';
import { ProblemBadge, RecordLink, Section, recordText } from './parts';

// A use case happens through one or more of its product's interfaces, with one flow for each (LA-V92-R83, LA-V92-R84).
// - A use case's page lists its flows by interface, each row the flow with its interface's name and kind.
// - A flow's page names the interface it goes through, under its title.
// - An interface's page lists the flows through it by capability, then use case, and the product's use cases that
//   have no flow through it yet. Both are worked out from the flows' interface and parent, never stored twice.

const interfaceOf = (index: SpecIndex, flow: SpecRecord) => index.byId.get(String(flow.row.interface_id ?? ''));

/** The flows of a use case, by interface ID. */
const flowsOf = (index: SpecIndex, useCase: string) =>
  (index.children.get(useCase) ?? []).filter((c) => c.kind === 'flow').sort((a, b) => String(a.row.interface_id).localeCompare(String(b.row.interface_id)));

/** An interface's name, with its kind when the name does not already say it (a CLI named CLI, an API named HTTP API). */
const saysKind = (iface: SpecRecord) => iface.title.toLowerCase().includes(String(iface.row.kind ?? '').toLowerCase());
const interfaceName = (iface: SpecRecord) => (saysKind(iface) ? iface.title : `${iface.title} · ${String(iface.row.kind)}`);

function InterfaceTag({ iface }: { iface: SpecRecord | undefined }) {
  if (!iface) return null;
  return <small className="meta" data-meta="interface">{interfaceName(iface)}</small>;
}

/** The "Flows" section of a use case's page: one row per flow, named by the interface it goes through. */
export function UseCaseFlows({ index, useCase }: { index: SpecIndex; useCase: SpecRecord }) {
  const flows = flowsOf(index, useCase.id);
  if (flows.length === 0) return null;
  return (
    <Section title="Flows by interface" count={flows.length} className="use-case-flows">
      <LongList
        label={`Flows of ${useCase.id}`}
        className="record-list flow-list"
        items={flows}
        itemKey={(r) => r.id}
        searchText={(r) => `${recordText(r)} ${interfaceOf(index, r)?.title ?? ''}`}
        render={(r) => (
          <div className="record-row">
            <RecordLink index={index} id={r.id} row />
            <span className="row-tags">
              <InterfaceTag iface={interfaceOf(index, r)} />
              <ProblemBadge problems={index.problemsFor.get(r.id) ?? []} />
            </span>
          </div>
        )}
      />
    </Section>
  );
}

/** The line under a flow's title that names its interface. */
export function FlowInterface({ index, flow }: { index: SpecIndex; flow: SpecRecord }) {
  const iface = interfaceOf(index, flow);
  return (
    <p className="flow-interface">
      Through {iface ? <RecordLink index={index} id={iface.id} /> : <code>{String(flow.row.interface_id ?? '')}</code>}
      {iface && !saysKind(iface) && <> <small className="meta">{String(iface.row.kind)}</small></>}
    </p>
  );
}

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
