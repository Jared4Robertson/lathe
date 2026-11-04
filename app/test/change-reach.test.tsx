import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';
import { reachLit, reachLitLines, setReachLight, useReachLight } from '../src/traceability/change-reach/light';
import type { ChangeReach } from '../src/traceability/change-reach/reads';

// A record's Change reach section (LA-TRC-UC24) and the Graph's Change reach light: what changing a record would touch,
// read through get-reach before the change is made.

const section = async () => (await screen.findByRole('heading', { level: 2, name: /^Change reach/ })).closest('section') as HTMLElement;
const headings = (el: HTMLElement, level: number) => within(el).getAllByRole('heading', { level }).map((h) => h.textContent);

describe("LA-V92-R79-T01 A record's page lists what changing it would touch, by stage with counts, each with its path, then its files and purposes", () => {
  it("lists a command's reach read through get-reach, with the path to each record, and lights it on the Graph", async () => {
    const { requests } = await openApp('/DM-SHOP-CMD01');
    await screen.findByRole('heading', { level: 1, name: 'Add item' });
    const reach = await section();
    expect(requests).toContain('GET /api/change-reach/get-reach?ids=DM-SHOP-CMD01');
    expect(headings(reach, 2)).toEqual(['Change reach5']);
    expect(headings(reach, 3)).toEqual(['Use cases1', 'Interface design3', 'Technical specification1', 'Files1', 'Purposes']);
    expect(reach).toHaveTextContent('Changing it touches 5 records and 1 file.');
    const endpointRequirement = reach.querySelector('[data-reached="DM-SHOP-EP01-R01"]') as HTMLElement;
    expect(within(endpointRequirement).getByText((_, el) => el?.getAttribute('data-meta') === 'path')).toHaveTextContent('sits under DM-SHOP-EP01, which sits under DM-SHOP-CMD01');
    expect(reach.querySelector('[data-reached="DM-V01"]')).toHaveTextContent('presents DM-SHOP-CMD01');
    expect(within(reach.querySelector('.reach-files') as HTMLElement).getByText('src/basket.ts')).toBeInTheDocument();
    expect(reach).toHaveTextContent('No use case reaches it, so no purpose rests on it.');
    const light = within(reach).getByRole('link', { name: 'Light on the Graph' });
    expect(light).toHaveAttribute('href', '/DM-SHOP-CMD01?stage=graph');
    const { result } = renderHook(() => useReachLight());
    expect(result.current[0]).toBe(false);
    fireEvent.click(light);
    expect(result.current[0]).toBe(true);
    act(() => setReachLight(false));
  });

  it("gives the product's page no Change reach: its reach is everything", async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { level: 2, name: /^Change reach/ })).toBeNull();
  });
});

describe('LA-V93-R78-T01 The Change reach light lights the focus and every record the change touches, and the lines between them', () => {
  it('lights the changed and touched records and only the lines whose two ends it lights', () => {
    const reach: ChangeReach = {
      changed: ['A'], count: 2, files: [], purposes: { useCases: [], journeys: [], outcomes: [] },
      groups: [{ stage: 'technical-specification', label: 'Technical specification', records: [
        { id: 'B', kind: 'command_handler', from: ['A'], path: [{ id: 'A', via: null }, { id: 'B', via: 'Sits under' }], file: null, state: null },
        { id: 'C', kind: 'ui_component', from: ['A'], path: [{ id: 'A', via: null }, { id: 'C', via: 'Renders' }], file: null, state: null },
      ] }],
    };
    const lit = reachLit(reach);
    expect([...lit]).toEqual(['A', 'B', 'C']);
    expect([...reachLitLines(lit, [{ id: 'A-B', source: 'A', target: 'B' }, { id: 'B-D', source: 'B', target: 'D' }, { id: 'C-A', source: 'C', target: 'A' }])]).toEqual(['A-B', 'C-A']);
  });

  it("turns on from the Graph's Picture switch, and off again", () => {
    const { result } = renderHook(() => useReachLight());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
