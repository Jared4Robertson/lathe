// Domains as vertical slices of business capability (FORMAT.md section 18): the domain-named-for-technology
// check, and the guidance in the format and the plugin's modeling skill.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', name);
const CHECK = 'domain-named-for-technology';
const FIX = "; name the domain for the capability it serves, and make the technology a layer in each domain's Design stage.";

let ws: Workspace;
beforeAll(async () => {
  // domain-names: DN-LEND, DN-BUILD and DN-ENG are named for capabilities; the others for technologies.
  ws = await loadWorkspace(fixture('domain-names'));
});

const messageOf = (id: string) => ws.problems.find((p) => p.check === CHECK && p.record === id)?.message;

describe('the domain-named-for-technology check', () => {
  it('LA-AUT-T103 A domain whose title names a technology layer, in any letter case, is a warning that says to name the capability', () => {
    expect(ws.problems.filter((p) => p.check === CHECK).map((p) => [p.severity, p.record])).toEqual([
      ['warning', 'DN-BACKEND'],
      ['warning', 'DN-DATA'],
      ['warning', 'DN-ELEC'],
      ['warning', 'DN-FRONTEND'],
      ['warning', 'DN-PAY'],
      ['warning', 'DN-WEB'],
    ]);
    expect(messageOf('DN-WEB')).toBe(
      `Domain DN-WEB is named for a technology, not a business capability: its title "Web App" says "web app"${FIX}`,
    );
    expect(messageOf('DN-PAY')).toContain('its title "Payments API" says "api"');
    expect(messageOf('DN-ELEC')).toContain('its title "ELECTRON shell" says "electron"');
    expect(messageOf('DN-DATA')).toContain('its title "Reporting databases" says "databases"');
  });

  it('LA-AUT-T104 A domain whose code names a technology is a warning, and one named so in both title and code says both', () => {
    expect(messageOf('DN-BACKEND')).toBe(
      `Domain DN-BACKEND is named for a technology, not a business capability: its code BACKEND says "backend"${FIX}`,
    );
    expect(messageOf('DN-FRONTEND')).toBe(
      'Domain DN-FRONTEND is named for a technology, not a business capability: its title "Front-end" says "front-end" '
        + `and its code FRONTEND says "frontend"${FIX}`,
    );
  });

  it('LA-AUT-T105 A technology word inside a longer word, or only in the domain\'s body, is not reported', () => {
    // Building holds "ui", Engineering holds "engine", and Lending's body names the web app, API, server and desktop.
    for (const id of ['DN-BUILD', 'DN-ENG', 'DN-LEND']) expect(messageOf(id), id).toBeUndefined();
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('the guidance', () => {
  it('LA-AUT-T12 The record format says what a domain is, with a good and a bad example', () => {
    const format = readFileSync(path.join(here, '..', 'FORMAT.md'), 'utf8');
    const section = format.split(/^## /m).find((s) => s.startsWith('18. Domains')) ?? '';
    expect(section).toContain('vertical slice');
    expect(section).toContain('business capability');
    expect(section).toMatch(/Define stage holds its domain model .* and its use cases/);
    expect(section).toMatch(/Design stage holds its flows, views, endpoints, components and tests/);
    expect(section).toContain('Technology is a layer inside a domain\'s Design stage');
    expect(section).toContain('platform domain or a pattern');
    expect(section).toContain('**Good:**');
    expect(section).toContain('**Bad:**');
    expect(section).toContain('`domain-named-for-technology`');
  });

  it('LA-AUT-T13 The modeling skill\'s first step finds the business capabilities and makes each a slice, with the questions that tell one from a layer', () => {
    const skill = readFileSync(path.join(here, '..', '..', 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
    const headings = [...skill.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings[0]).toBe('Step one: find the slices');
    const step = skill.split(/^## /m).find((s) => s.startsWith('Step one')) ?? '';
    expect(step).toContain('Before you write any record, find the product\'s business capabilities and make each one a domain');
    expect(step.match(/^- .+\?/gm)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
