'use client';

import type { SampleAmbiguity } from '@/lib/sample';
import {
  Button,
  EmptyState,
  Kbd,
  LocaleChip,
  StateRule,
  cn,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';
import { Check, CircleCheck } from 'lucide-react';
import * as React from 'react';

/**
 * The ambiguity queue — the product's differentiating surface.
 *
 * The design job: make "the agent refused to guess" read as the system working
 * correctly, not as a defect. So the question the agent asked is rendered as
 * prose at reading size, and the candidate readings are presented as a genuine
 * choice with the reasoning behind each — not as an error to clear.
 *
 * Keyboard-complete because this is processed in batches: j/k move between
 * items, 1–9 select a reading, Enter resolves. That is why this is a client
 * component; nothing else here needs to be.
 */
export function AmbiguityQueue({ items }: { items: SampleAmbiguity[] }) {
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState(0);
  const [choice, setChoice] = React.useState<Record<string, number>>({});
  const listRef = React.useRef<HTMLOListElement>(null);

  const open = items.filter((item) => !resolved.has(item.id));

  const resolve = React.useCallback((id: string) => {
    setResolved((prev) => new Set(prev).add(id));
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    const item = open[active];
    if (!item) return;

    // j/k move focus between cards rather than a detached highlight. Arrow
    // keys are left alone: inside a radio group they already move between
    // candidates, and hijacking them would break the native behaviour.
    if (event.key === 'j' || event.key === 'k') {
      event.preventDefault();
      const next = event.key === 'j' ? active + 1 : active - 1;
      const target = open[Math.max(0, Math.min(next, open.length - 1))];
      if (target) {
        setActive(Math.max(0, Math.min(next, open.length - 1)));
        listRef.current
          ?.querySelector<HTMLInputElement>(
            `input[name="candidate-${target.id}"]`,
          )
          ?.focus();
      }
    } else if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < item.candidates.length) {
        event.preventDefault();
        setChoice((prev) => ({ ...prev, [item.id]: index }));
      }
    } else if (event.key === 'Enter' && choice[item.id] !== undefined) {
      event.preventDefault();
      resolve(item.id);
      setActive((i) => Math.max(0, Math.min(i, open.length - 2)));
    }
  }

  if (open.length === 0) {
    return (
      <div className="rounded-lg border border-subtle">
        <EmptyState
          icon={CircleCheck}
          title="Nothing is waiting on you"
          description="Every escalation has been answered. New ones appear here when a run cannot resolve a string on its own."
        />
      </div>
    );
  }

  return (
    <>
      {/* Keys rendered as keys. This was bare mono text, which reads as prose
          and gets skipped; DESIGN.md §9 requires shortcuts to be shown, and
          showing them is what makes them scannable. */}
      <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-tertiary">
        <Kbd>j</Kbd>
        <Kbd>k</Kbd>
        <span>move</span>
        <span aria-hidden="true" className="px-1 text-subtle">
          ·
        </span>
        <Kbd>1</Kbd>–<Kbd>9</Kbd>
        <span>choose</span>
        <span aria-hidden="true" className="px-1 text-subtle">
          ·
        </span>
        <Kbd>Enter</Kbd>
        <span>resolve</span>
      </p>
      {/* No tabIndex: the candidate radios inside are already focusable, and
          keydown bubbles here from whichever one has focus. A focusable <ol>
          would be a second, fake focus stop that assistive technology would
          announce as a list you can "enter" but not act on. */}
      <ol
        ref={listRef}
        onKeyDown={onKeyDown}
        aria-label="Ambiguities awaiting a decision"
        className="flex flex-col gap-3"
      >
        {open.map((item, index) => (
          <AmbiguityCard
            key={item.id}
            item={item}
            active={index === active}
            chosen={choice[item.id]}
            onChoose={(i) => {
              setActive(index);
              setChoice((prev) => ({ ...prev, [item.id]: i }));
            }}
            onResolve={() => resolve(item.id)}
          />
        ))}
      </ol>
    </>
  );
}

function AmbiguityCard({
  item,
  active,
  chosen,
  onChoose,
  onResolve,
}: {
  item: SampleAmbiguity;
  active: boolean;
  chosen: number | undefined;
  onChoose: (index: number) => void;
  onResolve: () => void;
}) {
  const groupName = `candidate-${item.id}`;

  return (
    <li>
      <StateRule
        tone="ambiguous"
        className={cn(
          'rounded-e-lg border border-s-0 border-subtle bg-canvas py-4 pe-4',
          'transition-colors duration-(--duration-micro)',
          active && 'border-line bg-surface',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              {...localeTextProps(item.sourceLocale)}
              className="text-subtitle font-medium text-primary"
            >
              {item.source}
            </p>
            {/* Wraps rather than truncating.

                `truncate` was a no-op at desktop width and destructive below
                it: the line reads "src/components/Toolbar.tsx · Button label
                beside Save and Close", and at 390 it cut to "…besi…". The
                context is the half that answers the question — whether "Open"
                is the verb or the adjective is decided by it sitting on a
                button next to Save and Close — so truncating it removes the
                evidence at exactly the width where the reader has least of it.
                Both parts are short; wrapping costs a line. */}
            <p className="mt-1 font-mono text-caption text-tertiary">
              {item.origin}
              {item.context ? (
                <span className="font-sans"> · {item.context}</span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LocaleChip locale={item.sourceLocale} source />
            <LocaleChip locale={item.targetLocale} />
          </div>
        </div>

        {/* The question is the point of this surface, so it gets reading size.
            It used to sit on its own filled ground, which made this card three
            containers deep — card, question block, candidate boxes — for one
            string and two options (DESIGN.md §5.5). The fill is gone; the
            candidates below are bordered because they are click targets, and
            that is the one level of nesting this card is allowed. */}
        <p className="mt-2.5 text-body leading-6 text-secondary">
          {item.question}
        </p>

        <fieldset className="mt-3">
          <legend className="sr-only">
            Choose a reading for “{item.source}” in{' '}
            {localeDisplayName(item.targetLocale)}
          </legend>
          <div className="flex flex-col gap-2">
            {item.candidates.map((candidate, index) => {
              const id = `${groupName}-${index}`;
              const selected = chosen === index;
              return (
                <div key={candidate.text} className="contents">
                  <input
                    type="radio"
                    id={id}
                    name={groupName}
                    checked={selected}
                    onChange={() => onChoose(index)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
                      'transition-colors duration-(--duration-micro)',
                      'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                      selected
                        ? 'border-ambiguous bg-ambiguous-bg'
                        : 'border-subtle hover:border-line',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm',
                        'font-mono text-micro',
                        selected
                          ? 'bg-ambiguous text-inverse'
                          : 'bg-raised text-tertiary',
                      )}
                    >
                      {index + 1}
                    </span>
                    {/* The candidate translation is the subject of this whole
                        surface — it is the thing being chosen — and it sat at
                        `body` with its rationale at `small`, one step apart.
                        DESIGN.md §1.5 says the string is the hero and §3.5 says
                        one step is not a hierarchy. The reading now leads at
                        `subtitle` in its own script, and the reasoning recedes
                        to tertiary where it belongs: it supports the decision,
                        it is not the decision. */}
                    <span className="min-w-0">
                      <span
                        {...localeTextProps(item.targetLocale)}
                        className={cn(
                          'block text-subtitle font-medium leading-6 text-primary',
                          localeFontClass(item.targetLocale),
                        )}
                      >
                        {candidate.text}
                      </span>
                      <span className="mt-1 block text-small leading-5 text-tertiary">
                        {candidate.rationale}
                      </span>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* The "Needs a decision" badge that used to sit beside this button is
            gone. Every card on this surface carries that state — the page is
            the ambiguity queue and each card already wears the Iris State Rule,
            so the badge repeated the same fact a third time and competed with
            the one control that matters (DESIGN.md §6.2). */}
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            variant="primary"
            disabled={chosen === undefined}
            onClick={onResolve}
          >
            <Check aria-hidden="true" />
            Use this reading
          </Button>
          {chosen === undefined ? (
            <span className="text-caption text-tertiary">
              Pick a reading, or press <Kbd>1</Kbd>–
              <Kbd>{String(item.candidates.length)}</Kbd>
            </span>
          ) : null}
        </div>
      </StateRule>
    </li>
  );
}
