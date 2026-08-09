import { SiteNavMenu } from '@/components/site-nav-menu';
import { GITHUB_REPO_URL } from '@/lib/constants';
import { Button, ThemeToggle } from '@localize-infra/ui';
import Link from 'next/link';

const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/quality', label: 'Quality' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
] as const;

/**
 * The site header.
 *
 * Was 48px — the application's topbar height, borrowed onto a marketing page
 * where it read as cramped rather than dense. 64px gives the wordmark and nav
 * room to sit as a considered band instead of a strip.
 *
 * The mark is three rules of descending width, echoing the State Rule that the
 * product uses to carry confidence. It is now graphite throughout: the old
 * version spent Iris on its top rule, and Iris means one thing in this system —
 * your judgement is required. Chrome does not get to borrow it, on the landing
 * page or anywhere else.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-sm text-body font-semibold tracking-[-0.01em] text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span
            aria-hidden="true"
            className="flex h-4 w-4 flex-col justify-between py-[1px]"
          >
            <span className="block h-[2px] w-full rounded-full bg-primary" />
            <span className="block h-[2px] w-3/4 rounded-full bg-strong" />
            <span className="block h-[2px] w-1/2 rounded-full bg-line" />
          </span>
          Localize&nbsp;Infra
        </Link>

        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-6">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm text-body text-secondary transition-colors duration-(--duration-micro) hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <ThemeToggle />
            <Button asChild variant="secondary" size="sm">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
            </Button>
          </div>
          <SiteNavMenu items={NAV} />
        </div>
      </div>
    </header>
  );
}
