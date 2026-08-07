'use client';

import {
  AvatarRoot,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CheckboxField,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Field,
  FormColumn,
  Input,
  LocaleChip,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
  ProgressBar,
  RadioGroupRoot,
  RadioOption,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SeparatorLine,
  SheetContent,
  Skeleton,
  SkeletonTableRows,
  SortableTH,
  StateRule,
  StringCard,
  SwitchField,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  Textarea,
  type Tone,
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
} from '@localize-infra/ui';
import { Inbox, MoreHorizontal, Trash2 } from 'lucide-react';
import * as React from 'react';

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-subtle py-8 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="text-[15px] font-semibold text-primary">
        {title}
      </h2>
      {note ? (
        <p className="mt-1 max-w-[70ch] text-[13px] leading-6 text-secondary">
          {note}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TONES: Tone[] = [
  'neutral',
  'ambiguous',
  'confident',
  'degraded',
  'failed',
];

const TONE_LABEL: Record<Tone, string> = {
  neutral: 'Neutral',
  ambiguous: 'Needs a decision',
  confident: 'Confident',
  degraded: 'Degraded',
  failed: 'Failed',
};

/**
 * The component gallery.
 *
 * Every string shown here is either a design-system label or an illustrative
 * example of the *component*, not of a user's data — nothing on this page is
 * presented as belonging to a project, a run, or an account.
 */
export function DesignGallery() {
  const [sort, setSort] = React.useState<'asc' | 'desc' | null>('asc');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | undefined>();

  return (
    <div className="flex flex-col">
      <Section
        id="state-rule"
        title="State Rule"
        note="The signature element: a 3px rule on the leading edge of any surface carrying user copy, coloured by confidence. It uses border-inline-start, so it moves to the right-hand side in RTL. The rule is decorative — meaning is always carried by text as well."
      >
        <div className="flex flex-col gap-2">
          {TONES.map((tone) => (
            <StateRule key={tone} tone={tone} className="py-2">
              <p className="text-[14px] text-primary">{TONE_LABEL[tone]}</p>
            </StateRule>
          ))}
        </div>
      </Section>

      <Section
        id="string-card"
        title="String card"
        note="The product's atom. Source above, translation below, each with its own lang, dir and script font stack."
      >
        <div className="flex max-w-[40rem] flex-col gap-2">
          <StringCard
            tone="confident"
            stateLabel="Confident"
            source="Close"
            sourceLocale="en"
            translation="Schließen"
            targetLocale="de"
            origin="src/components/Modal.tsx"
            context="Settings dialog"
            approved
          />
          <StringCard
            tone="ambiguous"
            stateLabel="Needs a decision"
            source="Open"
            sourceLocale="en"
            translation="開く"
            targetLocale="ja"
            origin="src/components/Toolbar.tsx"
            context="Adjective or verb — ambiguous without context"
          />
          <StringCard
            tone="neutral"
            stateLabel="Not translated"
            source="Save changes"
            sourceLocale="en"
            targetLocale="ar"
            origin="src/components/Form.tsx"
          />
          <StringCard
            tone="confident"
            stateLabel="Confident"
            source="Settings"
            sourceLocale="en"
            translation="الإعدادات"
            targetLocale="ar"
            origin="src/app/settings/page.tsx"
            context="Right-to-left: the rule flips to the trailing edge"
          />
        </div>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section
        id="badges"
        title="Badges and chips"
        note="Always icon plus text, never colour alone. Locale chips show the code but carry the full language name as their accessible name."
      >
        <div className="flex flex-wrap items-center gap-2">
          {TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {TONE_LABEL[tone]}
            </Badge>
          ))}
          <LocaleChip locale="en" source />
          <LocaleChip locale="de" />
          <LocaleChip locale="pt-BR" />
          <LocaleChip locale="ja" />
          <LocaleChip locale="ar" />
        </div>
      </Section>

      <Section
        id="forms"
        title="Forms"
        note="Labels above inputs, always. Required is marked on the label. Errors appear below the field with an icon, never colour alone."
      >
        <FormColumn>
          <Field label="Project name" required help="Lowercase, no spaces.">
            <Input placeholder="web-app" />
          </Field>
          <Field
            label="Contact email"
            error={emailError}
            help="We use this only for failed runs."
          >
            <Input
              type="email"
              placeholder="you@example.com"
              onBlur={(event) =>
                // Validation on blur, never on keystroke: correcting someone
                // mid-word is hostile.
                setEmailError(
                  event.target.value && !event.target.value.includes('@')
                    ? 'Enter a valid email address.'
                    : undefined,
                )
              }
            />
          </Field>
          <Field label="Notes">
            <Textarea placeholder="Anything the translator should know…" />
          </Field>
          <Field label="Source locale">
            <SelectRoot defaultValue="en">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
              </SelectContent>
            </SelectRoot>
          </Field>

          <SeparatorLine />

          <CheckboxField
            label="Open a pull request automatically"
            description="Runs still stop and ask when the agent is unsure."
          />
          <RadioGroupRoot defaultValue="pr">
            <RadioOption
              value="pr"
              label="Pull request"
              description="The default, and the only output that touches your repository."
            />
            <RadioOption
              value="branch"
              label="Branch only"
              description="Push a branch and stop."
            />
          </RadioGroupRoot>
          <SwitchField
            label="Email me when a run fails"
            description="Failures only. There is no digest."
          />
        </FormColumn>
      </Section>

      <Section id="overlays" title="Dialogs, sheets, menus and tooltips">
        <div className="flex flex-wrap items-center gap-2">
          <DialogRoot>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disconnect this project?</DialogTitle>
                <DialogDescription>
                  Your translations stay in your repository. This only removes
                  the connection.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <Field label="Type the project name to confirm">
                  <Input placeholder="web-app" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Disconnect</Button>
              </DialogFooter>
            </DialogContent>
          </DialogRoot>

          <DialogRoot open={sheetOpen} onOpenChange={setSheetOpen}>
            <DialogTrigger asChild>
              <Button>Open sheet</Button>
            </DialogTrigger>
            <SheetContent>
              <DialogHeader>
                <DialogTitle>Detail</DialogTitle>
                <DialogDescription>
                  A sheet reveals detail without navigating away. A dialog
                  interrupts; this does not.
                </DialogDescription>
              </DialogHeader>
            </SheetContent>
          </DialogRoot>

          <MenuRoot>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem>
                Copy link
                <MenuShortcut>⌘C</MenuShortcut>
              </MenuItem>
              <MenuItem>Open in editor</MenuItem>
              <MenuSeparator />
              <MenuItem destructive>
                <Trash2 />
                Delete
              </MenuItem>
            </MenuContent>
          </MenuRoot>

          <TooltipRoot>
            <TooltipTrigger asChild>
              <Button variant="ghost">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>
              Tooltips carry hints, never information required to act.
            </TooltipContent>
          </TooltipRoot>
        </div>
      </Section>

      <Section
        id="tables"
        title="Tables"
        note="No zebra striping: alternating fills compete with the State Rule. Sort direction is an explicit icon plus aria-sort."
      >
        <Table>
          <THead>
            <TR>
              <SortableTH
                label="Locale"
                direction={sort}
                onSort={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
              />
              <TH>Script</TH>
              <TH numeric>Strings</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>German</TD>
              <TD>Latin</TD>
              <TD numeric>128</TD>
            </TR>
            <TR>
              <TD>Japanese</TD>
              <TD>Japanese</TD>
              <TD numeric>128</TD>
            </TR>
            <TR>
              <TD>Arabic</TD>
              <TD>Arabic</TD>
              <TD numeric>96</TD>
            </TR>
          </TBody>
        </Table>

        <p className="mt-6 mb-2 text-[13px] text-secondary">
          Empty and loading states render inside the body, so the headers stay
          visible.
        </p>
        <Table>
          <THead>
            <TR>
              <TH>Locale</TH>
              <TH>Script</TH>
              <TH numeric>Strings</TH>
            </TR>
          </THead>
          <TBody>
            <TableEmpty colSpan={3}>
              <EmptyState
                icon={Inbox}
                title="No locales yet"
                description="Locales appear here once a project is connected."
              />
            </TableEmpty>
          </TBody>
        </Table>

        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Locale</TH>
                <TH>Script</TH>
                <TH numeric>Strings</TH>
              </TR>
            </THead>
            <TBody>
              <SkeletonTableRows rows={3} columns={3} />
            </TBody>
          </Table>
        </div>
      </Section>

      <Section id="feedback" title="Feedback">
        <div className="flex max-w-[35rem] flex-col gap-6">
          <div className="flex items-center gap-3">
            <AvatarRoot name="Inès Moreau" />
            <span className="text-[14px] text-primary">Inès Moreau</span>
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>

          <ProgressBar value={62} label="Locales complete" />

          <ErrorState
            title="Could not reach the repository"
            description="The GitHub App installation may have been removed."
            detail="GET /repos/acme/web-app → 404 Not Found"
            onRetry={() => undefined}
          />

          <Card>
            <CardHeader>
              <CardTitle>Card</CardTitle>
              <CardDescription>
                Surfaces group related content; they do not add decoration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] leading-6 text-secondary">
                Chrome is neutral. Colour means something.
              </p>
            </CardContent>
          </Card>

          <TabsRoot defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">Overview</TabsTrigger>
              <TabsTrigger value="two">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="one">
              <p className="text-[14px] leading-6 text-secondary">
                Tabs group in-page sections. Deeper hierarchy goes here, never
                into a third level of sidebar.
              </p>
            </TabsContent>
            <TabsContent value="two">
              <p className="text-[14px] leading-6 text-secondary">
                Second panel.
              </p>
            </TabsContent>
          </TabsRoot>
        </div>
      </Section>
    </div>
  );
}
