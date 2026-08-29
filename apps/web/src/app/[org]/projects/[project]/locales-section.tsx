'use client';

import { Badge, Button, Field, useFieldControl } from '@localize-infra/ui';
import type { ComponentProps } from 'react';
import { useActionState } from 'react';
import { type LocalesState, setTargetLocales } from './locales-actions';

const EMPTY: LocalesState = {};

/** Claims the id its Field's label points at (see repository-section.tsx). */
function FieldInput(props: ComponentProps<'input'>) {
  return <input {...useFieldControl()} {...props} />;
}

export interface LocalesSectionProps {
  orgSlug: string;
  projectSlug: string;
  sourceLocale: string;
  targetLocales: string[];
}

/**
 * The languages a project translates into.
 *
 * This section did not exist. The project page displayed "None configured"
 * beside a label and offered nothing to press, which was accurate and useless:
 * `target_locales` was read in ten places across the app and written in none,
 * so every project had the column default and every run over one failed before
 * reaching a model, reporting "Every target locale failed" about locales that
 * had never been attempted.
 *
 * A plain comma-separated text field rather than a picker over a locale
 * registry. The product has no such registry — `parseTargetLocales` validates
 * BCP-47 by shape, the same expression the database checks — and a list of
 * every tag in the world would be a bigger decision than this screen needs. It
 * is also what the CLI already accepts in `--locales`, so the two halves of the
 * product ask for the value the same way.
 */
export function LocalesSection({
  orgSlug,
  projectSlug,
  sourceLocale,
  targetLocales,
}: LocalesSectionProps) {
  const [state, action, pending] = useActionState(
    setTargetLocales.bind(null, orgSlug, projectSlug),
    EMPTY,
  );

  return (
    <section
      aria-labelledby="languages"
      className="mt-8 rounded-lg border border-line bg-surface/40 px-5 py-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 id="languages" className="text-subtitle font-semibold text-primary">
          Languages
        </h2>
        {targetLocales.length === 0 ? (
          <Badge tone="neutral">None configured</Badge>
        ) : (
          <Badge tone="confident">
            {targetLocales.length} target
            {targetLocales.length === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      <p className="mt-4 max-w-[64ch] text-small leading-6 text-secondary">
        Strings are extracted in{' '}
        <span className="font-mono text-primary">{sourceLocale}</span> and
        translated into each language below.{' '}
        {targetLocales.length === 0 ? (
          /*
           * Said plainly, because the failure it predicts is otherwise
           * unreadable: a run with no target locales reports that every locale
           * failed, naming none, having called no model at all.
           */
          <strong className="font-medium text-primary">
            A run needs at least one, or it has nothing to do.
          </strong>
        ) : null}
      </p>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <Field
          label="Target locales"
          help="Separated by commas — for example de, ja, es, pt-BR. Leave empty to translate into nothing."
        >
          <FieldInput
            type="text"
            name="target_locales"
            defaultValue={targetLocales.join(', ')}
            placeholder="de, ja, es, pt-BR"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-md border border-line bg-canvas px-2 font-mono text-body text-primary placeholder:text-tertiary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          />
        </Field>

        <output aria-live="polite" className="contents">
          {state.error ? (
            <p className="rounded-md border border-failed bg-failed-bg px-3 py-2 text-small text-failed-text">
              {state.error}
            </p>
          ) : state.saved ? (
            <p className="rounded-md border border-confident bg-confident-bg px-3 py-2 text-small text-confident-text">
              Saved.
            </p>
          ) : null}
        </output>

        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save languages'}
          </Button>
        </div>
      </form>
    </section>
  );
}
