// Schema 2 to 3: a check carries its domain. Each check row in data/check.jsonl gains domain_id, the domain whose rules
// it reports, and a check without one no longer loads. A product that recorded its checks' domains as records of its
// own check_row kind (title: the check's name, under the domain) has them moved into the checks; then the check_row
// records, the kind's declaration and its fields go. A check no check_row names is left without a domain, as a to-do.
import type { Converter } from '../src/upgrade.ts';

const converter: Converter = {
  files(data, notes) {
    const rows = data.read('check_row');
    const domains = new Map(rows.map((r) => [String(r.title), String(r.domain_id)]));
    const checks = data.read('check');
    const lacking: string[] = [];
    const converted = checks.map((check) => {
      if (check.domain_id !== undefined) return check;
      const domain = domains.get(String(check.name));
      if (domain === undefined) {
        lacking.push(String(check.name));
        return check;
      }
      const { name, product_id: product, ...rest } = check;
      return { name, ...(product === undefined ? {} : { product_id: product }), domain_id: domain, ...rest };
    });
    const given = converted.filter((c, i) => c !== checks[i]).length;
    if (given) {
      data.write('check', converted);
      notes.changed(`Each check names its domain: ${given} given from the check_row records.`);
    }
    if (rows.length) {
      data.write('check_row', []);
      notes.changed(`The check_row records are gone: ${rows.length} removed, their domains now on the checks.`);
    }
    const kinds = data.read('product_kind');
    if (kinds.some((k) => k.name === 'check_row')) {
      data.write('product_kind', kinds.filter((k) => k.name !== 'check_row'));
      data.write('product_kind_field', data.read('product_kind_field').filter((f) => f.kind !== 'check_row'));
      notes.changed('The check_row kind is no longer declared.');
    }
    if (lacking.length) notes.todo(`A check names the domain whose rules it reports: add \`domain_id\` with the domain that owns the check, to ${lacking.join(', ')}.`);
  },
};

export default converter;
