import { useMemo } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

/** "7. Fitness" -> "7-fitness": the anchor a heading gets, so a page can link to a section. */
export const headingId = (text: string) =>
  text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${headingId(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

/** Renders Markdown to HTML and sanitises it, since records are written by agents as well as people. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }));
}

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  if (!source.trim()) return <p className="hint">No body text.</p>;
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
