import { Page, PageHeader, PageMeta, PageSection } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import {
  SAMPLE_AMBIGUITIES,
  SAMPLE_LOCALES,
  SAMPLE_REVIEW,
  SAMPLE_RUNS,
} from '@/lib/sample';
import { Badge, Button, cn } from '@localize-infra/ui';
import { ArrowRight, FileText, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Home' };

/**
 * Home answers exactly one question: is anything waiting for me?
 *
 * Not a dashboard. No charts, no totals nobody acts on, no activity feed. Two
 * blocked-work cards and a short run list, because this product wants merged
 * pull requests rather than daily logins.
 */
function BlockedCard({
  href,
  icon: Icon,
  count,
  title,
  description,
  tone,
}: {
  href: string;
  icon: typeof TriangleAlert;
  count: number;
  title: string;
  description: string;
  tone: 'ambiguous' | 'neutral';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-start gap-4 rounded-lg border p-4',
        'transition-colors duration-(--duration-micro)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        tone === 'ambiguous'
          ? 'border-ambiguous/40 bg-ambiguous-bg/40 hover:border-ambiguous'
          : 'border-subtle hover:border-line',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-5 shrink-0',
          tone === 'ambiguous' ? 'text-ambiguous' : 'text-tertiary',
        )}
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-title font-semibold tabular-nums text-primary">
            {count}
          </span>
          <span className="text-subtitle font-medium text-primary">
            {title}
          </span>
        </div>
        <p className="mt-1 text-small leading-5 text-secondary">
          {description}
        </p>
      </div>
      <ArrowRight
        className="mt-1 size-4 shrink-0 text-tertiary transition-transform duration-(--duration-micro) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function HomePage() {
  const behind = SAMPLE_LOCALES.filter((l) => l.translated < l.total).length;

  return (
    <Page>
      <PageHeader
        title="What needs you"
        purpose="Runs happen in your terminal. This is where the work that needs a human ends up."
        meta={
          <>
            <PageMeta label="Locales">{SAMPLE_LOCALES.length}</PageMeta>
            <PageMeta label="Behind">{behind}</PageMeta>
            <PageMeta label="Last run">2 hours ago</PageMeta>
          </>
        }
      />

      <div className="mt-6">
        <SampleBanner>
          There is no connected project, so nothing here reflects your code. The
          counts, runs and locales below are illustrative.
        </SampleBanner>
      </div>

      <SampleRegion label="Blocked work" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <BlockedCard
            href="/ambiguity"
            icon={TriangleAlert}
            count={SAMPLE_AMBIGUITIES.length}
            title="need a decision"
            description="The agent escalated rather than guessing. One is blocking a pull request."
            tone="ambiguous"
          />
          <BlockedCard
            href="/review"
            icon={FileText}
            count={SAMPLE_REVIEW.length}
            title="await review"
            description="Suggested copy ready for a human to approve or edit."
            tone="neutral"
          />
        </div>

        <PageSection
          title="Recent runs"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/runs">All runs</Link>
            </Button>
          }
        >
          <ul className="divide-y divide-subtle rounded-lg border border-subtle">
            {SAMPLE_RUNS.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <Badge
                  tone={
                    run.state === 'succeeded'
                      ? 'confident'
                      : run.state === 'partial'
                        ? 'degraded'
                        : 'failed'
                  }
                >
                  {run.state === 'succeeded'
                    ? 'Succeeded'
                    : run.state === 'partial'
                      ? 'Partial'
                      : 'Failed'}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-caption text-secondary">
                  {run.trigger}
                </span>
                <span className="text-small tabular-nums text-tertiary">
                  {run.locales - run.localesFailed}/{run.locales} locales
                </span>
                <span className="text-small text-tertiary">{run.when}</span>
              </li>
            ))}
          </ul>
        </PageSection>
      </SampleRegion>
    </Page>
  );
}
