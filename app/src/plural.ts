// English plurals for kind labels, in one place so every page and the graph agree:
// "Capability" -> "Capabilities", "Use case" -> "Use cases", "Fitness" stays "Fitness".
// Only the end of the label changes ("Use-case requirement" -> "Use-case requirements").
export function plural(label: string): string {
  if (/s$/i.test(label)) return label; // "Fitness", or a label already plural
  if (/(x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}
