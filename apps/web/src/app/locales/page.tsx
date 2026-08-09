import { Page, PageHeader, PageMeta } from '@/components/page';
import { SampleBanner, SampleRegion } from '@/components/sample';
import {
  type ConfidenceState,
  SAMPLE_LOCALES,
  SAMPLE_SOURCE_STRINGS,
} from '@/lib/sample';
import {
  Badge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type Tone,
  cn,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Locales' };

const TONE: Record<ConfidenceState, { tone: Tone; label: string }> = {
  confident: { tone: 'confident', label: 'Current' },
  ambiguous: { tone: 'ambiguous', label: 'Needs a decision' },
  degraded: { tone: 'degraded', label: 'Behind' },
  failed: { tone: 'failed', label: 'Failed' },
  neutral: { tone: 'neutral', label: 'Unknown' },
};

/** A sample of the language, in its own script — the product proving it cares. */
const SPECIMEN: Record<string, string | undefined> = {
  de: 'Änderungen speichern',
  ja: '変更を保存',
  es: 'Guardar cambios',
  'pt-BR': 'Salvar alterações',
  ar: 'حفظ التغييرات',
};

export default function LocalesPage() {
  const behind = SAMPLE_LOCALES.filter((l) => l.translated < l.total).length;

  return (
    <Page>
      <PageHeader
        title="Locales"
        purpose="Which languages are current, which are behind, and which are waiting on a human."
        meta={
          <>
            <PageMeta label="Languages">{SAMPLE_LOCALES.length}</PageMeta>
            <PageMeta label="Source strings">{SAMPLE_SOURCE_STRINGS}</PageMeta>
            <PageMeta label="Behind">{behind}</PageMeta>
          </>
        }
      />

      <div className="mt-6">
        <SampleBanner>
          Your locales live in your repository. Listing them here needs a
          connected project, so these five show the shape instead.
        </SampleBanner>
      </div>

      <SampleRegion label="Locale coverage" className="mt-6">
        <Table>
          <THead>
            <TR>
              <TH>Language</TH>
              <TH className="hidden lg:table-cell">Specimen</TH>
              <TH numeric>Coverage</TH>
              <TH numeric className="hidden sm:table-cell">
                Translated
              </TH>
              <TH>State</TH>
              <TH className="hidden md:table-cell">Last run</TH>
            </TR>
          </THead>
          <TBody>
            {SAMPLE_LOCALES.map((locale) => {
              const pct = Math.round((locale.translated / locale.total) * 100);
              const tone = TONE[locale.state];
              return (
                <TR key={locale.code}>
                  <TD>
                    <span className="font-medium text-primary">
                      {localeDisplayName(locale.code)}
                    </span>{' '}
                    <span className="font-mono text-caption text-tertiary">
                      {locale.code}
                    </span>
                    {/* The specimen is the product demonstrating that it
                        renders each script properly, so it folds in here
                        rather than being dropped on a narrow screen. */}
                    <span
                      {...localeTextProps(locale.code)}
                      className={cn(
                        'mt-0.5 block text-small text-secondary lg:hidden',
                        localeFontClass(locale.code),
                      )}
                    >
                      {SPECIMEN[locale.code]}
                    </span>
                  </TD>
                  {/* Rendered in its own script and direction. A localization
                      product showing Arabic in a Latin fallback would be
                      arguing against itself. */}
                  <TD className="hidden lg:table-cell">
                    <span
                      {...localeTextProps(locale.code)}
                      className={localeFontClass(locale.code)}
                    >
                      {SPECIMEN[locale.code]}
                    </span>
                  </TD>
                  <TD numeric>
                    <span className="tabular-nums">{pct}%</span>
                  </TD>
                  <TD numeric className="hidden sm:table-cell">
                    {locale.translated}/{locale.total}
                  </TD>
                  <TD>
                    <Badge tone={tone.tone}>{tone.label}</Badge>
                  </TD>
                  <TD className="hidden whitespace-nowrap md:table-cell">
                    {locale.lastRun}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </SampleRegion>
    </Page>
  );
}
