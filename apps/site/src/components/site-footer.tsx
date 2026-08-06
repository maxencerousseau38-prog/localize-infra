import { GITHUB_REPO_URL } from '@/lib/constants';
import Link from 'next/link';

const GROUPS: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}[] = [
  {
    title: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/quality', label: 'Quality' },
      { href: '/roadmap', label: 'Roadmap' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/security', label: 'Security & data' },
      { href: '/security#subprocessors', label: 'Sub-processors' },
    ],
  },
  {
    title: 'Open source',
    links: [{ href: GITHUB_REPO_URL, label: 'GitHub', external: true }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-subtle">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="font-semibold tracking-tight text-primary">
            Localize&nbsp;Infra
          </p>
          <p className="mt-2 max-w-56 text-[13px] leading-5 text-tertiary">
            Localization infrastructure for teams who keep their strings in Git.
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-[12px] font-medium uppercase tracking-wide text-tertiary">
              {group.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={`${group.title}-${link.href}-${link.label}`}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-sm text-[14px] text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="rounded-sm text-[14px] text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-subtle">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-[13px] text-tertiary">
            Early access. The CLI works today; the hosted product is in
            development.
          </p>
        </div>
      </div>
    </footer>
  );
}
