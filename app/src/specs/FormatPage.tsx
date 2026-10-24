import { useEffect } from 'react';
import format from '../../../lathe/FORMAT.md?raw';
import { Markdown } from './Markdown';

/** Lathe's record format (lathe/FORMAT.md), read-only, so pages can link to a section such as /format#7-fitness. */
export function FormatPage({ hash }: { hash: string }) {
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.();
  }, [hash]);
  return (
    <div className="spec-body">
      <p className="eyebrow">Reference · lathe/FORMAT.md</p>
      <Markdown source={format} />
    </div>
  );
}
