import { describe, expect, it } from 'vitest';
import { aboutLink, aboutModel, errorModel, launchModel, launchStep, modelQuery, parseLocalAction, REFERENCE_URL, REPO_URL, specErrorMessage } from '../src/launch.ts';

const colors = { background: '#0A0F12', foreground: '#E2E8EA' };

describe('The launch view names the product, and the error page says what failed and offers Retry, another folder and the folder itself', () => {
  it('LA-V68-R01-T02 shows "Opening <product>…" in the window\'s colors, with no buttons', () => {
    expect(launchModel('Tool Library', colors)).toEqual({ view: 'launch', heading: 'Opening Tool Library…', actions: [], colors });
  });

  it('LA-V68-R01-T02 lifts on ready, turns to the error page on error, and waits otherwise', () => {
    expect(launchStep('ready')).toBe('ready');
    expect(launchStep('error')).toBe('error');
    for (const other of ['loading', null, undefined, '', 1]) expect(launchStep(other)).toBe('wait');
  });

  it('LA-V69-R01-T01 builds the error page with the message, the folder and the three actions', () => {
    const model = errorModel('Tool Library', '/Users/person/work/tools', '  data/use_case.jsonl:3: the line is not one JSON object  ', colors, 'darwin', '/Users/person');
    expect(model).toMatchObject({ view: 'error', heading: "Lathe couldn't open Tool Library", message: 'data/use_case.jsonl:3: the line is not one JSON object', folder: '~/work/tools' });
    expect(model.actions.map((a) => a.label)).toEqual(['Retry', 'Open Another Folder…', 'Reveal in Finder']);
    expect(model.actions.filter((a) => a.primary).map((a) => a.id)).toEqual(['retry']);
    expect(errorModel('X', '/x', '', colors, 'win32').message).toBe('The engine stopped without saying why.');
    expect(errorModel('X', '/x', 'e', colors, 'win32').actions[2].label).toBe('Show in File Explorer');
  });

  it('LA-V69-R01-T01 reads the engine\'s message from the spec API\'s answer', () => {
    expect(specErrorMessage(400, { error: 'data/use_case.jsonl:2: use_case.domain_id is required [required]' })).toBe('data/use_case.jsonl:2: use_case.domain_id is required [required]');
    expect(specErrorMessage(500, null)).toBe('GET /api/spec answered 500.');
    expect(specErrorMessage(400, { error: '  ' })).toBe('GET /api/spec answered 400.');
  });

  it('LA-V69-R02-T01 runs only a button the page shows', () => {
    const error = errorModel('X', '/x', 'e', colors, 'darwin');
    expect(parseLocalAction('retry', error.actions)).toBe('retry');
    expect(parseLocalAction('reveal', error.actions)).toBe('reveal');
    expect(parseLocalAction('open-repo', error.actions)).toBeNull();
    expect(parseLocalAction('retry', launchModel('X', colors).actions)).toBeNull();
    expect(parseLocalAction({ id: 'retry' }, error.actions)).toBeNull();
  });

  it('LA-V70-R01-T01 passes the model to the page as JSON, and gives About the versions and its two links', () => {
    const about = aboutModel({ app: '0.1.0', engine: '0.1.0', electron: '45.0.0', chrome: '140', node: '24' }, colors);
    expect(about.versions.map((v) => v.label)).toEqual(['Version', 'Engine', 'Electron', 'Chromium', 'Node.js']);
    expect(about.links.map((l) => l.url)).toEqual([REPO_URL, REFERENCE_URL]);
    expect(aboutLink(REPO_URL, about)).toBe(REPO_URL);
    expect(aboutLink('https://example.com/', about)).toBeNull();
    expect(aboutModel({ app: '1', engine: null, electron: '1', chrome: '1', node: '1' }, colors).versions[1].value).toBe('unknown');
    expect(JSON.parse(modelQuery(about).model)).toEqual(about);
  });
});
