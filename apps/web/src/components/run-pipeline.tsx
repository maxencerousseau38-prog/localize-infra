import type { SampleRunStage, StageState } from '@/lib/sample';
import { cn } from '@localize-infra/ui';
import { Check, Circle, Minus, TriangleAlert, X } from 'lucide-react';

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
  StageState,
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
  skipped: {
    icon: Minus,
    label: 'Did not run',
    dot: 'border-subtle bg-raised text-tertiary',
    text: 'text-tertiary',
  },
};

export function RunPipeline({ stages }: { stages: SampleRunStage[] }) {
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
            key={stage.name}
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
                {stage.name}
              </p>
              <p className="mt-0.5 text-small leading-5 text-secondary">
                {stage.detail}
              </p>
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
export function StageLegendIcon({ state }: { state: StageState }) {
  const Icon = STAGE[state]?.icon ?? Circle;
  return <Icon className="size-3.5" aria-hidden="true" />;
}
