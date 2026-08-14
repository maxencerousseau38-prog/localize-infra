'use client';

import {
  ACCOUNT_BACKEND,
  type Viewer,
  hasAccess,
  readViewer,
} from '@/lib/account';
import {
  EXAMPLE_PR_URL,
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
import { ArrowRight, GitPullRequest, Terminal } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

/**
 * The conversion point.
 *
 * Placed on the primary action rather than at the top of the page: a visitor
 * should understand what the product does, see the pull request it actually
 * produced, and read the honest status board before anything asks them for
 * something. By the time this opens they have a reason to want it.
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
 * No account yet.
 *
 * There is no auth backend, so this shows no email field and no password field.
 * A sign-up form that cannot sign anyone up is the simulation this project
 * forbids, and it is worse than saying so: it costs the reader their address to
 * discover the same fact. Instead it says plainly what exists today and hands
 * over the two things that genuinely work — the CLI, and the pull request it
 * produced on a real repository.
 */
function AnonymousBranch() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Run it on your repository</DialogTitle>
        <DialogDescription>
          Localize Infra runs from your terminal and opens a pull request. That
          path works today and needs no account.
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
                Detection and extraction run locally. Nothing leaves your
                machine until you ask for a translation.
              </p>
              <div className="mt-3">
                <CopyCommand command={INSTALL_COMMAND} />
              </div>
              <p className="mt-2 text-caption leading-5 text-secondary">
                Not published to npm yet — today it runs from a clone.{' '}
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
         * The honest part. Hosted accounts are the thing a visitor would expect
         * to sign up for here, and they do not exist — so this says that in the
         * same words the status board on the landing page uses, rather than
         * collecting an address against a product that cannot yet be sold.
         */}
        <StateRule tone="neutral" className="ps-3">
          <p className="text-body font-medium text-primary">
            Hosted accounts are not built yet
          </p>
          <p className="mt-1 text-small leading-5 text-secondary">
            There is no sign-up because there is nothing to sign in to: no
            accounts, no projects, no billing. When that exists it will be a
            flat subscription, never metered by words, keys or seats.
          </p>
          <p className="mt-2 text-caption leading-5 text-secondary">
            Follow the repository to know when it ships.
          </p>
        </StateRule>
      </DialogBody>

      <DialogFooter>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <a href={EXAMPLE_PR_URL} target="_blank" rel="noreferrer noopener">
            <GitPullRequest aria-hidden="true" />
            See the pull request
          </a>
        </Button>
        <Button asChild variant="primary" className="w-full sm:w-auto">
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener">
            Follow on GitHub
            <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Signed in, not entitled.
 *
 * Unreachable today — `ACCOUNT_BACKEND` is `'absent'` and `readViewer` returns
 * anonymous — and implemented anyway, because the branch is where the decision
 * lives and retrofitting it later is how paywalls end up shown to paying
 * customers. Tests drive it directly by injecting a viewer.
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
 * filled; for everyone else it opens a dialog explaining that hosted accounts
 * are not built, which DESIGN.md §4.5.3 calls a gated beta and demotes to
 * secondary. The caller decides, because the caller knows what else is on the
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
