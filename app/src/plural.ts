// English plurals for kind labels, in one place so every page and the graph agree:
// "Capability" -> "Capabilities", "Use case" -> "Use cases", "Fitness" stays "Fitness".
// Only the end of the label changes ("UC requirement" -> "UC requirements").
export function plural(label: string): string {
  if (/s$/i.test(label)) return label; // "Fitness", or a label already plural
  if (/(x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
export function lowerLabel(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}
