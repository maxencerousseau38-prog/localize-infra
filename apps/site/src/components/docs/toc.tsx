import Link from 'next/link';

export interface TocEntry {
  id: string;
  label: string;
}

/**
 * On-page navigation for the documentation.
 *
 * Plain anchor links, not a scroll-spy: highlighting the active section needs
 * an IntersectionObserver and turns a fully static page into a client
 * component, which is a real cost for a cosmetic gain. `scroll-margin-top` on
 * the headings keeps targets clear of the sticky header.
 *
 * Hidden below `lg` rather than collapsed into a disclosure — at that width the
 * page is a single column and the browser's own find-in-page is a better index
 * than a duplicated list of links pushing the content down.
 */
export function DocsToc({ entries }: { entries: TocEntry[] }) {
  return (
    <nav
      aria-label="On this page"
      className="hidden lg:sticky lg:top-20 lg:block lg:self-start"
    >
      <h2 className="text-caption font-medium uppercase tracking-wide text-tertiary">
        On this page
      </h2>
      <ul className="mt-3 space-y-1.5 border-s border-subtle">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`#${entry.id}`}
              className="-ms-px block border-s border-transparent ps-3 text-small leading-6 text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
