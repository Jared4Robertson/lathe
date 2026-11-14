// Schema 9 to 10: a domain may be marked platform. Each domain gains `platform`, yes when it is the plumbing the
// business domains stand on (the app shell, the store, the commands) rather than a business capability of its own; the
// nav lists the platform domains under Platform, after the business domains. Like every yes/no that is no by default,
// it is left out when no, so no row changes. Which domains are platform only the Owner knows: that is the to-do.
import type { Converter } from '../src/upgrade.ts';

const converter: Converter = {
  files(data, notes) {
    const domains = data.read('domain');
    // A domain already marked is data already upgraded.
    if (domains.length === 0 || domains.some((d) => 'platform' in d)) return;
    notes.changed(`A domain may be marked platform: none of the ${domains.length} domains is yet, so the nav lists every one under Domains.`);
    notes.todo('Mark each domain that is plumbing the business domains stand on, rather than a business capability, as platform (`lathe domain change-domain --id <domain> --platform true`): the nav then lists it under Platform.');
  },
};

export default converter;
