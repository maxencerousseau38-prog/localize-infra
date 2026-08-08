import { GITHUB_REPO_URL } from '@/lib/constants';
import { Button, ThemeToggle } from '@localize-infra/ui';
import Link from 'next/link';

const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/quality', label: 'Quality' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-canvas/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm font-semibold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {/* Geometric mark: three stacked rules echoing the State Rule, the
              system's signature element. Decorative — the wordmark carries the name. */}
          <span
            aria-hidden="true"
            className="flex h-4 w-4 flex-col justify-between py-[2px]"
          >
            <span className="block h-[2px] w-full rounded-full bg-ambiguous" />
            <span className="block h-[2px] w-3/4 rounded-full bg-confident" />
            <span className="block h-[2px] w-1/2 rounded-full bg-strong" />
          </span>
          Localize&nbsp;Infra
        </Link>

        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-[14px] text-secondary transition-colors duration-(--duration-micro) hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
              GitHub
            </a>
          </Button>
        </div>
      </div>

      {/* Navigation is duplicated below the bar on small screens rather than
          hidden behind a menu button: three links do not justify a sheet, and
          a visible row costs one tap fewer. */}
      <nav aria-label="Main, compact" className="sm:hidden">
        <ul className="flex items-center gap-1 overflow-x-auto border-t border-subtle px-4 py-1.5">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-block rounded-md px-2.5 py-1.5 text-[13px] text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
