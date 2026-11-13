// English plurals for kind labels, in one place so every page and the graph agree:
// "Entity" -> "Entities", "Use case" -> "Use cases", "Status" stays "Status".
// Only the end of the label changes ("UC requirement" -> "UC requirements").
export function plural(label: string): string {
  if (/s$/i.test(label)) return label; // a label already plural, or one ending in s
  if (/(x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
export function lowerLabel(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/** A figure with thousands separators ("2,100"), the one way a count reads wherever a page shows it (LA-PAT-APP-UX-R25). */
export function figureText(n: number): string {
  return n.toLocaleString('en-US');
}

/** A count with its noun, singular for one: "1 domain", "4 domains". */
export function countOf(n: number, label: string): string {
  return `${n} ${n === 1 ? label : plural(label)}`;
}
