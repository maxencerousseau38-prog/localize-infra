import { PageHeader } from '@/components/page-header';
import { Badge } from '@localize-infra/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/roadmap' },
  title: 'Roadmap',
  description:
    'What is shipped, what is being built, and what is deliberately out of scope.',
};

type Status = 'shipped' | 'building' | 'planned';

const STAGES: {
  status: Status;
  label: string;
  items: { title: string; body: string }[];
}[] = [
  {
    status: 'shipped',
    label: 'Shipped',
    items: [
      {
        title: 'Quality evaluation harness',
        body: 'A corpus of 414 real strings from five open-source projects, with deterministic placeholder, ICU and plural checks enforced on every build.',
      },
      {
        title: 'CLI: extract, translate, open a pull request',
        body: 'Framework detection, AST extraction, per-language failure isolation, a merge that never overwrites hand-edited translations, and pull request creation through a GitHub App. Validated end to end against a real repository.',
      },
    ],
  },
  {
    status: 'building',
    label: 'Being built',
    items: [
      {
        title: 'Placeholder-aware extraction',
        body: 'A sentence containing an expression — “You have {count} messages” — is currently extracted as separate fragments. Translating fragments independently breaks word order in German, Japanese and Arabic, so this is being fixed before any broader quality claim is made.',
      },
      {
        title: 'Typed SDK',
        body: 'Generated types from your key catalogue, so a missing key fails the build rather than reaching a user as a blank space.',
      },
    ],
  },
  {
    status: 'planned',
    label: 'Planned',
    items: [
      {
        title: 'Ambiguity review queue',
        body: 'Strings the model could not confidently resolve, presented one at a time with the component screenshot and surrounding code, resolvable with a single keystroke. A decision, once made, is never asked again.',
      },
      {
        title: 'Visual context capture',
        body: 'Per-component screenshots collected in CI, so the translator — human or model — can see where a string appears before choosing a word.',
      },
      {
        title: 'Review surface for non-developers',
        body: 'A way for the person who notices the German call-to-action reads like a legal notice to fix it, without seeing a key, a file path, or a merge conflict.',
      },
      {
        title: 'Hosted accounts and billing',
        body: 'Projects, members and plans. Deliberately last: the pull request is the product, and a dashboard that arrives before it is needed is how localization tools became heavy in the first place.',
      },
    ],
  },
];

const TONE: Record<Status, 'confident' | 'ambiguous' | 'neutral'> = {
  shipped: 'confident',
  building: 'ambiguous',
  planned: 'neutral',
};

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Build status"
        title="What is shipped, and what is not"
        lede="Stated in the past and future tense correctly, which is rarer than it should be."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="space-y-14">
          {STAGES.map((stage) => (
            <section
              key={stage.status}
              aria-labelledby={`stage-${stage.status}`}
            >
              <div className="flex items-center gap-3">
                <h2
                  id={`stage-${stage.status}`}
                  className="font-display text-headline font-semibold text-primary"
                >
                  {stage.label}
                </h2>
                <Badge tone={TONE[stage.status]}>{stage.items.length}</Badge>
              </div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:gap-8">
                {stage.items.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-lg border border-subtle p-5"
                  >
                    <h3 className="text-subtitle font-semibold text-primary">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-body leading-6 text-secondary">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section
          aria-labelledby="out-of-scope"
          className="mt-16 border-t border-subtle pt-10"
        >
          <h2
            id="out-of-scope"
            className="text-title font-semibold text-primary"
          >
            Deliberately not building
          </h2>
          <p className="mt-3 max-w-[64ch] text-body leading-6 text-secondary">
            A translator marketplace, a full CAT editor, vendor management, or
            project management with assignments and due dates. These are the
            features that made existing localization platforms slow and
            expensive. Saying no to them is a product decision, not an
            oversight.
          </p>
        </section>
      </div>
    </>
  );
}
