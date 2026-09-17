'use client';

import {
  ACCOUNT_BACKEND,
  type Viewer,
  hasAccess,
  readViewer,
} from '@/lib/account';
import {
  APP_URL,
  CLI_PERSONAL_TOKENS_LIVE,
  CLI_PUBLISHED_TO_NPM,
  GITHUB_REPO_URL,
  INSTALL_COMMAND,
} from '@/lib/constants';
import {
  Button,
  CopyCommand,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  StateRule,
} from '@localize-infra/ui';
import { ArrowUpRight, Globe, Terminal } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

/**
 * The conversion point.
 *
 * Placed on the primary action rather than at the top of the page: a visitor
 * should understand what the product does, see the run it actually produced,
 * and read the honest status board before anything asks them for something. By the time this opens they have a reason to want it.
 *
 * Three branches, chosen from the viewer rather than from a prop, so the same
 * button is correct for everyone:
 *
 *   anonymous                     → how to get access
 *   authenticated, no entitlement → upgrade
 *   authenticated, entitled       → never opens; the action proceeds
 *
 * The last one matters most and is the easiest to get wrong: a paywall shown to
 * someone who has already paid is the most expensive interruption a product can
 * ship. `hasAccess` is checked before the dialog is opened at all.
 *
 * Built on the Radix dialog already in `packages/ui` rather than a second copy
 * installed from a registry. It has this product's focus management, scroll
 * lock, geometry and tokens; a parallel one would be the second design system
 * DESIGN.md §15 exists to prevent, for a component we already own.
 */
export function ConversionDialog({
  open,
  onOpenChange,
  viewer,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" onCloseAutoFocus={onCloseAutoFocus}>
        {viewer.status === 'anonymous' ? (
          <AnonymousBranch />
        ) : (
          <UpgradeBranch email={viewer.email} />
        )}
      </DialogContent>
    </DialogRoot>
  );
}

/**
 * No account on this site.
 *
 * Two paths work today, and this names both. The CLI runs from a terminal; the
 * hosted app runs the same pipeline from a browser. This said the second did
 * not exist — "Hosted accounts are not built yet … no accounts, no projects, no
 * billing" — for as long as it did exist, with sign-up open.
 *
 * Still no email field and no password field here. Accounts live on the app's
 * own origin, which this static site does not talk to (`ACCOUNT_BACKEND`), so a
 * form here could only forward the reader somewhere else. The link does that
 * honestly.
 *
 * The pull request button is gone: the only pull request the site could point
 * at is in a private repository, and a 404 is not a thing that "genuinely
 * works".
 */
function AnonymousBranch() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Run it on your repository</DialogTitle>
        <DialogDescription>
          Two ways work today. Both end in a pull request on your repository.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Terminal
              className="mt-0.5 size-4 shrink-0 text-tertiary"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-primary">
                Start from the command line
              </p>
              <p className="mt-1 text-small leading-5 text-secondary">
                Detection and extraction run on your machine.{' '}
                {CLI_PERSONAL_TOKENS_LIVE
                  ? 'Translation goes through our hosted API, with a personal token from your workspace.'
                  : 'Translation goes through an API you run yourself.'}
              </p>
              <div className="mt-3">
                <CopyCommand command={INSTALL_COMMAND} />
              </div>
              {/* The same flag the hero and /docs read. This sentence was
                  hard-coded and kept saying "not published" after the package
                  reached npm. */}
              <p className="mt-2 text-caption leading-5 text-secondary">
                {!CLI_PUBLISHED_TO_NPM
                  ? 'Not published to npm yet — today it runs from a clone.'
                  : CLI_PERSONAL_TOKENS_LIVE
                    ? 'On npm. Create a token in the hosted app first.'
                    : 'On npm. It needs an API you run yourself.'}{' '}
                <Link
                  href="/docs#install"
                  className="rounded-sm text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Install guide
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/*
         * The hosted path, with its limits stated where it is offered.
         *
         * Neutral, not jade: it works, but it is early access with a narrow
         * scope, and the limits below are the part a visitor needs before
         * clicking rather than after.
         */}
        <StateRule tone="neutral" className="ps-3">
          <div className="flex items-start gap-3">
            <Globe
              className="mt-0.5 size-4 shrink-0 text-tertiary"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-primary">
                Or run it from the hosted app
              </p>
              <p className="mt-1 text-small leading-5 text-secondary">
                Early access. Create an account, connect a GitHub repository,
                choose languages and run the pipeline from your browser — no API
                to run. Public repositories are self-serve; private ones are not
                yet.
              </p>
              <p className="mt-2 text-caption leading-5 text-secondary">
                There is no billing and nothing is charged. When there is, it
                will be a flat subscription, never metered by words, keys or
                seats.
              </p>
            </div>
          </div>
        </StateRule>
      </DialogBody>

      <DialogFooter>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
            Follow on GitHub
          </a>
        </Button>
        <Button asChild variant="primary" className="w-full sm:w-auto">
          <a href={APP_URL} target="_blank" rel="noreferrer noopener">
            Open the hosted app
            <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Signed in, not entitled.
 *
 * Unreachable from this site — `ACCOUNT_BACKEND` is `'absent'` and
 * `readViewer` returns anonymous — and implemented anyway, because the branch
 * is where the decision lives and retrofitting it later is how paywalls end up
 * shown to paying customers. Tests drive it directly by injecting a viewer.
 *
 * It quotes no price. Pricing is not modelled (see /pricing, which says so),
 * and a number invented here would be the first false claim on the site.
 */
function UpgradeBranch({ email }: { email: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Upgrade to run this on a private repository</DialogTitle>
        <DialogDescription>
          Signed in as {email}. Your plan does not cover the hosted product yet.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <StateRule tone="degraded" className="ps-3">
          <p className="text-body font-medium text-primary">
            Prices are not published yet
          </p>
          <p className="mt-1 text-small leading-5 text-secondary">
            Pricing is flat, per project and active language — never per word,
            character, key or seat. The figures are not modelled, so none are
            shown here.
          </p>
        </StateRule>
        <p className="text-small leading-5 text-secondary">
          Public repositories are free, permanently.
        </p>
      </DialogBody>

      <DialogFooter>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/pricing">Read the pricing commitments</Link>
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * The gated action.
 *
 * Checks entitlement before opening anything: a viewer who already has access
 * goes straight to the destination and never sees a dialog. That is the whole
 * point of the check living here rather than inside the dialog.
 *
 * `variant` exists because the weight this deserves depends on whether it can
 * do what it says. For a viewer with access it is a working action and can be
 * filled; for everyone else it opens a dialog laying out the two ways to run
 * it, which DESIGN.md §4.5.3 calls a gated beta and demotes to secondary. The caller decides, because the caller knows what else is on the
 * page competing for the one primary slot §10 allows.
 */
export function GatedAction({
  children,
  className,
  href = '/docs#install',
  variant = 'primary',
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const viewer = readViewer();

  if (hasAccess(viewer)) {
    // Entitled: this genuinely navigates, so it is allowed to be filled
    // regardless of how the caller styles the gated case.
    return (
      <Button asChild variant="primary" size="lg" className={className}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant}
        size="lg"
        className={className}
        onClick={() => setOpen(true)}
        data-account-backend={ACCOUNT_BACKEND}
      >
        {children}
      </Button>
      {/*
       * Focus restoration is owned here, not left to Radix.
       *
       * Radix returns focus to its own `DialogTrigger`, and this dialog is
       * opened from state rather than through one — so on close there was
       * nothing to return to and a keyboard user was dropped at the top of the
       * document. The command palette in this codebase shipped the same defect
       * once; it is not detectable by eye, only by pressing Escape and looking
       * at where focus went.
       */}
      <ConversionDialog
        open={open}
        onOpenChange={setOpen}
        viewer={viewer}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}
