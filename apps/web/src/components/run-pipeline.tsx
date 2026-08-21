import type { RunStageState, RunStageView } from '@/lib/runs/progress';
import { PIPELINE_STAGE_NAMES, cn } from '@localize-infra/ui';
import { Check, Circle, Loader, Minus, TriangleAlert, X } from 'lucide-react';

/**
 * The run, drawn as the pipeline it traversed.
 *
 * A run is not an event with a status — it is a walk through detect → extract →
 * translate → escalate → open a pull request, and it can stop or degrade at any
 * step. Drawing the stages makes both the product's workflow and this run's
 * outcome legible in one glance, and shows a failure *where it happened* rather
 * than as a red badge at the top of the page.
 *
 * This is an ordered list because the content genuinely is a sequence — the
 * numbering carries information the reader needs, which is the only thing that
 * justifies it.
 */
const STAGE: Record<
  RunStageState,
  { icon: typeof Check; label: string; dot: string; text: string }
> = {
  done: {
    icon: Check,
    label: 'Completed',
    dot: 'border-confident bg-confident text-inverse',
    text: 'text-primary',
  },
  partial: {
    icon: TriangleAlert,
    label: 'Partly completed',
    dot: 'border-degraded bg-degraded text-inverse',
    text: 'text-primary',
  },
  failed: {
    icon: X,
    label: 'Failed',
    dot: 'border-failed bg-failed text-inverse',
    text: 'text-primary',
  },
  // Reached and still working. Not a spinner: the row re-reads itself while a
  // run is moving, so an animated glyph here would be motion for its own sake.
  active: {
    icon: Loader,
    label: 'In progress',
    dot: 'border-strong bg-canvas text-primary',
    text: 'text-primary',
  },
  // Not yet, which is a different fact from `skipped`. A pending stage may
  // still run; a skipped one never will.
  pending: {
    icon: Minus,
    label: 'Not yet',
    dot: 'border-subtle bg-raised text-tertiary',
    text: 'text-tertiary',
  },
};

export function RunPipeline({ stages }: { stages: RunStageView[] }) {
  return (
    <ol
      aria-label="Pipeline stages"
      className="flex flex-col gap-0 sm:flex-row sm:gap-0"
    >
      {stages.map((stage, index) => {
        const style = STAGE[stage.state];
        const Icon = style.icon;
        const last = index === stages.length - 1;

        return (
          <li
            key={stage.id}
            className="relative flex flex-1 gap-3 pb-5 sm:flex-col sm:gap-0 sm:pb-0"
          >
            {/* The connector. Horizontal between stages on desktop, vertical on
                mobile, and absent after the last stage — a line leading nowhere
                would imply a step that does not exist. */}
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bg-subtle',
                  'left-[11px] top-6 h-[calc(100%-1.5rem)] w-px',
                  'sm:left-auto sm:top-[11px] sm:h-px sm:w-full sm:translate-x-6',
                )}
              />
            ) : null}

            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border',
                style.dot,
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" strokeWidth={2.5} />
            </span>

            <div className="min-w-0 sm:mt-2.5 sm:pe-6">
              <p className={cn('text-body font-medium', style.text)}>
                {PIPELINE_STAGE_NAMES[
                  stage.id as keyof typeof PIPELINE_STAGE_NAMES
                ] ?? stage.id}
              </p>
              {stage.detail ? (
                <p className="mt-0.5 text-small leading-5 text-secondary">
                  {stage.detail}
                </p>
              ) : null}
              {/* State reaches assistive technology as words. The dot colour
                  and glyph are for the eye only. */}
              <span className="sr-only">{style.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Kept beside the pipeline so both read from one definition of state. */
export function StageLegendIcon({ state }: { state: RunStageState }) {
  const Icon = STAGE[state]?.icon ?? Circle;
  return <Icon className="size-3.5" aria-hidden="true" />;
}
