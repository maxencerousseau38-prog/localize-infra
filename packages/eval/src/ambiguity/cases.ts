import type { AmbiguityCase, TargetLocale } from '@localize-infra/schemas';

/**
 * The ambiguity corpus, as data rather than as 200 hand-written blobs.
 *
 * Every entry below expands into a **pair**: the same source string, the same
 * target locale, the same category, differing only in `surroundingCode`. One
 * context leaves the reading open and the agent should ask; the other settles
 * it and the agent should not.
 *
 * That pairing is the design, not a convenience. A corpus of ambiguous strings
 * alone measures recall and nothing else, and an agent that escalates on every
 * string would score perfectly on it — while producing exactly the failure the
 * production prompt warns about, "a queue that raises every second string is a
 * queue nobody reads". Holding everything constant but the context is what
 * makes a disagreement attributable: if both halves of a pair get the same
 * answer, the agent is not reading context, whatever its total score says.
 *
 * The three categories are the ones the production prompt itself declares as
 * grounds for escalation (`apps/api/src/translate/prompt.ts`). Measuring
 * against criteria the system was never given would be measuring the wrong
 * thing.
 */

const LOCALES = ['de', 'ja', 'es', 'ar', 'pt-BR'] as const;
/** Locales whose adjectives inflect for gender/number, so a bare one is underdetermined. */
const AGREEMENT_LOCALES = ['es', 'pt-BR', 'ar', 'de'] as const;
/** Locales that force a formality choice which changes the wording. */
const REGISTER_LOCALES = ['de', 'ja', 'es'] as const;

interface Pair {
  /** Stable slug; becomes `<slug>-open` and `<slug>-settled`. */
  slug: string;
  key: string;
  text: string;
  /** The two readings, named. Used in the rationale so it is checkable. */
  senses: [string, string];
  /** Sibling keys that leave the reading open. */
  open: [string, string][];
  /** Sibling keys that settle it, and which sense they settle on. */
  settled: [string, string][];
  settledSense: string;
  component: string;
  file: string;
}

function renderSiblings(pairs: [string, string][], self: [string, string]) {
  const all = [...pairs.slice(0, 2), self, ...pairs.slice(2)];
  return all.map(([k, v]) => `  "${k}": ${JSON.stringify(v)},`).join('\n');
}

function expand(
  pair: Pair,
  category: AmbiguityCase['category'],
  locale: TargetLocale,
  openRationale: string,
  settledRationale: string,
): AmbiguityCase[] {
  const self: [string, string] = [pair.key, pair.text];
  return [
    {
      id: `${pair.slug}-open`,
      pairId: pair.slug,
      sourceText: pair.text,
      filePath: pair.file,
      componentName: pair.component,
      surroundingCode: renderSiblings(pair.open, self),
      targetLocale: locale,
      category,
      expected: 'escalate',
      rationale: openRationale,
    },
    {
      id: `${pair.slug}-settled`,
      pairId: pair.slug,
      sourceText: pair.text,
      filePath: pair.file,
      componentName: pair.component,
      surroundingCode: renderSiblings(pair.settled, self),
      targetLocale: locale,
      category,
      expected: 'confident',
      rationale: settledRationale,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Polysemy — a word with two genuinely different senses.
 * ------------------------------------------------------------------ */

const POLYSEMY: Pair[] = [
  {
    slug: 'left',
    key: 'label.left',
    text: 'Left',
    senses: ['the direction', 'the quantity remaining'],
    open: [
      ['label.total', 'Total'],
      ['label.status', 'Status'],
      ['label.updated', 'Updated'],
    ],
    settled: [
      ['align.left', 'Left'],
      ['align.center', 'Center'],
      ['align.right', 'Right'],
    ],
    settledSense: 'the direction',
    component: 'Toolbar',
    file: 'src/locales/en.json',
  },
  {
    slug: 'close',
    key: 'action.close',
    text: 'Close',
    senses: ['dismiss this dialog', 'near in distance'],
    open: [
      ['action.more', 'More'],
      ['action.select', 'Select'],
      ['action.apply', 'Apply'],
    ],
    settled: [
      ['dialog.confirm', 'Confirm'],
      ['dialog.cancel', 'Cancel'],
      ['dialog.dismiss', 'Dismiss'],
    ],
    settledSense: 'dismiss this dialog',
    component: 'Dialog',
    file: 'src/locales/en.json',
  },
  {
    slug: 'post',
    key: 'label.post',
    text: 'Post',
    senses: ['publish, a verb', 'an article, a noun'],
    open: [
      ['label.draft', 'Draft'],
      ['label.item', 'Item'],
      ['label.entry', 'Entry'],
    ],
    settled: [
      ['feed.postCount', '{count} posts'],
      ['feed.postAuthor', 'Written by {name}'],
      ['feed.postPublished', 'Published {date}'],
    ],
    settledSense: 'an article, a noun',
    component: 'Feed',
    file: 'src/locales/en.json',
  },
  {
    slug: 'home',
    key: 'label.home',
    text: 'Home',
    senses: ['the start destination', 'a dwelling'],
    open: [
      ['label.profile', 'Profile'],
      ['label.address', 'Address'],
      ['label.property', 'Property'],
    ],
    settled: [
      ['nav.dashboard', 'Dashboard'],
      ['nav.settings', 'Settings'],
      ['nav.signOut', 'Sign out'],
    ],
    settledSense: 'the start destination',
    component: 'Navigation',
    file: 'src/locales/en.json',
  },
  {
    slug: 'free',
    key: 'label.free',
    text: 'Free',
    senses: ['costing nothing', 'unoccupied or available'],
    open: [
      ['label.status', 'Status'],
      ['label.type', 'Type'],
      ['label.name', 'Name'],
    ],
    settled: [
      ['plan.free', 'Free'],
      ['plan.pro', 'Pro — $19/month'],
      ['plan.enterprise', 'Enterprise — contact us'],
    ],
    settledSense: 'costing nothing',
    component: 'PricingTable',
    file: 'src/locales/en.json',
  },
  {
    slug: 'match',
    key: 'label.match',
    text: 'Match',
    senses: ['a sports fixture', 'a correspondence between two things'],
    open: [
      ['label.result', 'Result'],
      ['label.detail', 'Detail'],
      ['label.summary', 'Summary'],
    ],
    settled: [
      ['search.matchCount', '{count} matches found'],
      ['search.matchExact', 'Exact match'],
      ['search.matchNone', 'No results'],
    ],
    settledSense: 'a correspondence between two things',
    component: 'SearchResults',
    file: 'src/locales/en.json',
  },
  {
    slug: 'order',
    key: 'label.order',
    text: 'Order',
    senses: ['a purchase', 'a sequence'],
    open: [
      ['label.value', 'Value'],
      ['label.field', 'Field'],
      ['label.column', 'Column'],
    ],
    settled: [
      ['sort.orderAsc', 'Ascending'],
      ['sort.orderDesc', 'Descending'],
      ['sort.sortBy', 'Sort by'],
    ],
    settledSense: 'a sequence',
    component: 'TableHeader',
    file: 'src/locales/en.json',
  },
  {
    slug: 'play',
    key: 'action.play',
    text: 'Play',
    senses: ['start playback', 'a round of a game'],
    open: [
      ['action.start', 'Start'],
      ['action.stop', 'Stop'],
      ['action.reset', 'Reset'],
    ],
    settled: [
      ['player.pause', 'Pause'],
      ['player.mute', 'Mute'],
      ['player.fullscreen', 'Full screen'],
    ],
    settledSense: 'start playback',
    component: 'MediaPlayer',
    file: 'src/locales/en.json',
  },
  {
    slug: 'record',
    key: 'label.record',
    text: 'Record',
    senses: ['capture audio or video', 'a stored database row'],
    open: [
      ['label.action', 'Action'],
      ['label.item', 'Item'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['db.recordCreated', 'Record created'],
      ['db.recordDeleted', 'Record deleted'],
      ['db.recordCount', '{count} records'],
    ],
    settledSense: 'a stored database row',
    component: 'DataTable',
    file: 'src/locales/en.json',
  },
  {
    slug: 'charge',
    key: 'label.charge',
    text: 'Charge',
    senses: ['a fee', 'battery level'],
    open: [
      ['label.amount', 'Amount'],
      ['label.level', 'Level'],
      ['label.state', 'State'],
    ],
    settled: [
      ['billing.chargeFailed', 'Charge failed'],
      ['billing.chargeRefunded', 'Refunded'],
      ['billing.invoice', 'Invoice'],
    ],
    settledSense: 'a fee',
    component: 'Billing',
    file: 'src/locales/en.json',
  },
  {
    slug: 'draw',
    key: 'label.draw',
    text: 'Draw',
    senses: ['sketch on the canvas', 'a tied result'],
    open: [
      ['label.result', 'Result'],
      ['label.mode', 'Mode'],
      ['label.tool', 'Tool'],
    ],
    settled: [
      ['canvas.pen', 'Pen'],
      ['canvas.eraser', 'Eraser'],
      ['canvas.shapes', 'Shapes'],
    ],
    settledSense: 'sketch on the canvas',
    component: 'Canvas',
    file: 'src/locales/en.json',
  },
  {
    slug: 'fine',
    key: 'label.fine',
    text: 'Fine',
    senses: ['a monetary penalty', 'acceptable, adequate'],
    open: [
      ['label.status', 'Status'],
      ['label.note', 'Note'],
      ['label.detail', 'Detail'],
    ],
    settled: [
      ['penalty.fineAmount', 'Fine amount'],
      ['penalty.fineDue', 'Due date'],
      ['penalty.finePaid', 'Paid'],
    ],
    settledSense: 'a monetary penalty',
    component: 'Penalties',
    file: 'src/locales/en.json',
  },
  {
    slug: 'light',
    key: 'label.light',
    text: 'Light',
    senses: ['illumination or a light theme', 'not heavy'],
    open: [
      ['label.option', 'Option'],
      ['label.variant', 'Variant'],
      ['label.preset', 'Preset'],
    ],
    settled: [
      ['theme.dark', 'Dark'],
      ['theme.system', 'Match system'],
      ['theme.label', 'Appearance'],
    ],
    settledSense: 'a light theme',
    component: 'ThemeSwitcher',
    file: 'src/locales/en.json',
  },
  {
    slug: 'present',
    key: 'label.present',
    text: 'Present',
    senses: ['currently attending', 'to show to an audience'],
    open: [
      ['label.state', 'State'],
      ['label.mode', 'Mode'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['attendance.absent', 'Absent'],
      ['attendance.late', 'Late'],
      ['attendance.excused', 'Excused'],
    ],
    settledSense: 'currently attending',
    component: 'Attendance',
    file: 'src/locales/en.json',
  },
  {
    slug: 'scale',
    key: 'label.scale',
    text: 'Scale',
    senses: ['resize proportionally', 'a measuring device or range'],
    open: [
      ['label.setting', 'Setting'],
      ['label.factor', 'Factor'],
      ['label.unit', 'Unit'],
    ],
    settled: [
      ['transform.rotate', 'Rotate'],
      ['transform.flip', 'Flip'],
      ['transform.resize', 'Resize'],
    ],
    settledSense: 'resize proportionally',
    component: 'TransformPanel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'second',
    key: 'label.second',
    text: 'Second',
    senses: ['the ordinal after first', 'a unit of time'],
    open: [
      ['label.position', 'Position'],
      ['label.value', 'Value'],
      ['label.step', 'Step'],
    ],
    settled: [
      ['duration.minute', 'Minute'],
      ['duration.hour', 'Hour'],
      ['duration.day', 'Day'],
    ],
    settledSense: 'a unit of time',
    component: 'DurationPicker',
    file: 'src/locales/en.json',
  },
  {
    slug: 'sign',
    key: 'action.sign',
    text: 'Sign',
    senses: ['add a signature', 'a notice or symbol'],
    open: [
      ['action.view', 'View'],
      ['action.send', 'Send'],
      ['action.copy', 'Copy'],
    ],
    settled: [
      ['contract.signHere', 'Sign here'],
      ['contract.signature', 'Signature'],
      ['contract.signedOn', 'Signed on {date}'],
    ],
    settledSense: 'add a signature',
    component: 'ContractSigning',
    file: 'src/locales/en.json',
  },
  {
    slug: 'state',
    key: 'label.state',
    text: 'State',
    senses: ['a condition', 'an administrative region'],
    open: [
      ['label.name', 'Name'],
      ['label.code', 'Code'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['address.city', 'City'],
      ['address.postalCode', 'Postal code'],
      ['address.country', 'Country'],
    ],
    settledSense: 'an administrative region',
    component: 'AddressForm',
    file: 'src/locales/en.json',
  },
  {
    slug: 'store',
    key: 'label.store',
    text: 'Store',
    senses: ['a shop', 'to save data'],
    open: [
      ['label.action', 'Action'],
      ['label.target', 'Target'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['shop.cart', 'Cart'],
      ['shop.checkout', 'Checkout'],
      ['shop.products', 'Products'],
    ],
    settledSense: 'a shop',
    component: 'Shop',
    file: 'src/locales/en.json',
  },
  {
    slug: 'tie',
    key: 'label.tie',
    text: 'Tie',
    senses: ['a drawn result', 'a necktie'],
    open: [
      ['label.outcome', 'Outcome'],
      ['label.type', 'Type'],
      ['label.category', 'Category'],
    ],
    settled: [
      ['score.win', 'Win'],
      ['score.loss', 'Loss'],
      ['score.points', 'Points'],
    ],
    settledSense: 'a drawn result',
    component: 'Scoreboard',
    file: 'src/locales/en.json',
  },
  {
    slug: 'train',
    key: 'label.train',
    text: 'Train',
    senses: ['a railway vehicle', 'to teach a model or person'],
    open: [
      ['label.subject', 'Subject'],
      ['label.target', 'Target'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['travel.departure', 'Departure'],
      ['travel.platform', 'Platform'],
      ['travel.arrival', 'Arrival'],
    ],
    settledSense: 'a railway vehicle',
    component: 'TravelSearch',
    file: 'src/locales/en.json',
  },
  {
    slug: 'watch',
    key: 'action.watch',
    text: 'Watch',
    senses: ['view or observe', 'a wristwatch'],
    open: [
      ['action.open', 'Open'],
      ['action.add', 'Add'],
      ['action.remove', 'Remove'],
    ],
    settled: [
      ['repo.star', 'Star'],
      ['repo.fork', 'Fork'],
      ['repo.unwatch', 'Unwatch'],
    ],
    settledSense: 'view or observe',
    component: 'RepositoryHeader',
    file: 'src/locales/en.json',
  },
  {
    slug: 'book',
    key: 'action.book',
    text: 'Book',
    senses: ['to reserve', 'a printed volume'],
    open: [
      ['action.select', 'Select'],
      ['action.find', 'Find'],
      ['action.list', 'List'],
    ],
    settled: [
      ['booking.checkIn', 'Check in'],
      ['booking.checkOut', 'Check out'],
      ['booking.guests', 'Guests'],
    ],
    settledSense: 'to reserve',
    component: 'BookingForm',
    file: 'src/locales/en.json',
  },
  {
    slug: 'check',
    key: 'label.check',
    text: 'Check',
    senses: ['to verify', 'a bank cheque'],
    open: [
      ['label.item', 'Item'],
      ['label.value', 'Value'],
      ['label.method', 'Method'],
    ],
    settled: [
      ['ci.checkPassed', 'Passed'],
      ['ci.checkFailed', 'Failed'],
      ['ci.checkPending', 'Pending'],
    ],
    settledSense: 'to verify',
    component: 'ChecksList',
    file: 'src/locales/en.json',
  },
  {
    slug: 'contact',
    key: 'label.contact',
    text: 'Contact',
    senses: ['a person in an address book', 'to get in touch'],
    open: [
      ['label.entry', 'Entry'],
      ['label.record', 'Record'],
      ['label.field', 'Field'],
    ],
    settled: [
      ['crm.contactEmail', 'Email'],
      ['crm.contactPhone', 'Phone'],
      ['crm.contactCompany', 'Company'],
    ],
    settledSense: 'a person in an address book',
    component: 'ContactCard',
    file: 'src/locales/en.json',
  },
  {
    slug: 'cut',
    key: 'action.cut',
    text: 'Cut',
    senses: ['move to clipboard', 'a reduction'],
    open: [
      ['action.apply', 'Apply'],
      ['action.undo', 'Undo'],
      ['action.clear', 'Clear'],
    ],
    settled: [
      ['edit.copy', 'Copy'],
      ['edit.paste', 'Paste'],
      ['edit.selectAll', 'Select all'],
    ],
    settledSense: 'move to clipboard',
    component: 'EditMenu',
    file: 'src/locales/en.json',
  },
  {
    slug: 'date',
    key: 'label.date',
    text: 'Date',
    senses: ['a calendar day', 'a social engagement'],
    open: [
      ['label.entry', 'Entry'],
      ['label.detail', 'Detail'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['filter.dateFrom', 'From'],
      ['filter.dateTo', 'To'],
      ['filter.dateRange', 'Date range'],
    ],
    settledSense: 'a calendar day',
    component: 'DateFilter',
    file: 'src/locales/en.json',
  },
  {
    slug: 'file',
    key: 'action.file',
    text: 'File',
    senses: ['a document', 'to submit formally'],
    open: [
      ['action.new', 'New'],
      ['action.manage', 'Manage'],
      ['action.review', 'Review'],
    ],
    settled: [
      ['fs.folder', 'Folder'],
      ['fs.upload', 'Upload'],
      ['fs.download', 'Download'],
    ],
    settledSense: 'a document',
    component: 'FileBrowser',
    file: 'src/locales/en.json',
  },
  {
    slug: 'issue',
    key: 'label.issue',
    text: 'Issue',
    senses: ['a reported problem', 'to hand out'],
    open: [
      ['label.subject', 'Subject'],
      ['label.action', 'Action'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['tracker.issueOpen', 'Open'],
      ['tracker.issueClosed', 'Closed'],
      ['tracker.issueAssignee', 'Assignee'],
    ],
    settledSense: 'a reported problem',
    component: 'IssueTracker',
    file: 'src/locales/en.json',
  },
  {
    slug: 'lead',
    key: 'label.lead',
    text: 'Lead',
    senses: ['a sales prospect', 'to guide'],
    open: [
      ['label.role', 'Role'],
      ['label.item', 'Item'],
      ['label.stage', 'Stage'],
    ],
    settled: [
      ['crm.leadQualified', 'Qualified'],
      ['crm.leadSource', 'Source'],
      ['crm.leadConverted', 'Converted'],
    ],
    settledSense: 'a sales prospect',
    component: 'LeadPipeline',
    file: 'src/locales/en.json',
  },
  {
    slug: 'note',
    key: 'label.note',
    text: 'Note',
    senses: ['a written annotation', 'a musical tone'],
    open: [
      ['label.item', 'Item'],
      ['label.value', 'Value'],
      ['label.entry', 'Entry'],
    ],
    settled: [
      ['notes.addNote', 'Add note'],
      ['notes.editNote', 'Edit note'],
      ['notes.deleteNote', 'Delete note'],
    ],
    settledSense: 'a written annotation',
    component: 'NotesPanel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'object',
    key: 'label.object',
    text: 'Object',
    senses: ['a thing on the canvas', 'to raise an objection'],
    open: [
      ['label.target', 'Target'],
      ['label.action', 'Action'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['canvas.group', 'Group'],
      ['canvas.layer', 'Layer'],
      ['canvas.bringToFront', 'Bring to front'],
    ],
    settledSense: 'a thing on the canvas',
    component: 'CanvasObjects',
    file: 'src/locales/en.json',
  },
  {
    slug: 'plant',
    key: 'label.plant',
    text: 'Plant',
    senses: ['a factory site', 'a growing organism'],
    open: [
      ['label.site', 'Site'],
      ['label.item', 'Item'],
      ['label.record', 'Record'],
    ],
    settled: [
      ['factory.shift', 'Shift'],
      ['factory.output', 'Output'],
      ['factory.downtime', 'Downtime'],
    ],
    settledSense: 'a factory site',
    component: 'FactoryDashboard',
    file: 'src/locales/en.json',
  },
  {
    slug: 'point',
    key: 'label.point',
    text: 'Point',
    senses: ['a score unit', 'a location or coordinate'],
    open: [
      ['label.value', 'Value'],
      ['label.metric', 'Metric'],
      ['label.unit', 'Unit'],
    ],
    settled: [
      ['map.latitude', 'Latitude'],
      ['map.longitude', 'Longitude'],
      ['map.marker', 'Marker'],
    ],
    settledSense: 'a location or coordinate',
    component: 'MapEditor',
    file: 'src/locales/en.json',
  },
  {
    slug: 'range',
    key: 'label.range',
    text: 'Range',
    senses: ['an interval between two values', 'a cooking stove'],
    open: [
      ['label.item', 'Item'],
      ['label.property', 'Property'],
      ['label.field', 'Field'],
    ],
    settled: [
      ['filter.min', 'Minimum'],
      ['filter.max', 'Maximum'],
      ['filter.between', 'Between'],
    ],
    settledSense: 'an interval between two values',
    component: 'RangeFilter',
    file: 'src/locales/en.json',
  },
  {
    slug: 'right',
    key: 'label.right',
    text: 'Right',
    senses: ['the direction', 'correct, or an entitlement'],
    open: [
      ['label.answer', 'Answer'],
      ['label.value', 'Value'],
      ['label.option', 'Option'],
    ],
    settled: [
      ['align.left', 'Left'],
      ['align.center', 'Center'],
      ['align.justify', 'Justify'],
    ],
    settledSense: 'the direction',
    component: 'AlignmentControls',
    file: 'src/locales/en.json',
  },
  {
    slug: 'row',
    key: 'label.row',
    text: 'Row',
    senses: ['a horizontal line of cells', 'to propel a boat'],
    open: [
      ['label.item', 'Item'],
      ['label.action', 'Action'],
      ['label.unit', 'Unit'],
    ],
    settled: [
      ['grid.column', 'Column'],
      ['grid.cell', 'Cell'],
      ['grid.header', 'Header'],
    ],
    settledSense: 'a horizontal line of cells',
    component: 'DataGrid',
    file: 'src/locales/en.json',
  },
  {
    slug: 'run',
    key: 'action.run',
    text: 'Run',
    senses: ['execute a job', 'to move quickly on foot'],
    open: [
      ['action.begin', 'Begin'],
      ['action.finish', 'Finish'],
      ['action.repeat', 'Repeat'],
    ],
    settled: [
      ['pipeline.runLogs', 'Logs'],
      ['pipeline.runFailed', 'Run failed'],
      ['pipeline.runDuration', 'Duration'],
    ],
    settledSense: 'execute a job',
    component: 'PipelineRuns',
    file: 'src/locales/en.json',
  },
  {
    slug: 'bank',
    key: 'label.bank',
    text: 'Bank',
    senses: ['a financial institution', 'the side of a river'],
    open: [
      ['label.name', 'Name'],
      ['label.location', 'Location'],
      ['label.type', 'Type'],
    ],
    settled: [
      ['payment.accountNumber', 'Account number'],
      ['payment.sortCode', 'Sort code'],
      ['payment.iban', 'IBAN'],
    ],
    settledSense: 'a financial institution',
    component: 'PaymentDetails',
    file: 'src/locales/en.json',
  },
  {
    slug: 'board',
    key: 'label.board',
    text: 'Board',
    senses: ['a task board', 'a group of directors'],
    open: [
      ['label.group', 'Group'],
      ['label.view', 'View'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['kanban.column', 'Column'],
      ['kanban.card', 'Card'],
      ['kanban.swimlane', 'Swimlane'],
    ],
    settledSense: 'a task board',
    component: 'KanbanBoard',
    file: 'src/locales/en.json',
  },
  {
    slug: 'break',
    key: 'label.break',
    text: 'Break',
    senses: ['a pause', 'to damage or split'],
    open: [
      ['label.event', 'Event'],
      ['label.action', 'Action'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['schedule.lunch', 'Lunch'],
      ['schedule.shiftStart', 'Shift start'],
      ['schedule.shiftEnd', 'Shift end'],
    ],
    settledSense: 'a pause',
    component: 'ShiftSchedule',
    file: 'src/locales/en.json',
  },
  {
    slug: 'case',
    key: 'label.case',
    text: 'Case',
    senses: ['a support ticket or legal matter', 'letter casing'],
    open: [
      ['label.item', 'Item'],
      ['label.option', 'Option'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['text.uppercase', 'UPPERCASE'],
      ['text.lowercase', 'lowercase'],
      ['text.matchCase', 'Match case'],
    ],
    settledSense: 'letter casing',
    component: 'TextFormatting',
    file: 'src/locales/en.json',
  },
  {
    slug: 'change',
    key: 'label.change',
    text: 'Change',
    senses: ['a modification', 'money returned'],
    open: [
      ['label.item', 'Item'],
      ['label.amount', 'Amount'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['diff.added', 'Added'],
      ['diff.removed', 'Removed'],
      ['diff.modified', 'Modified'],
    ],
    settledSense: 'a modification',
    component: 'DiffViewer',
    file: 'src/locales/en.json',
  },
  {
    slug: 'current',
    key: 'label.current',
    text: 'Current',
    senses: ['the present one', 'electrical flow'],
    open: [
      ['label.value', 'Value'],
      ['label.reading', 'Reading'],
      ['label.measure', 'Measure'],
    ],
    settled: [
      ['plan.previous', 'Previous plan'],
      ['plan.upcoming', 'Upcoming plan'],
      ['plan.renewal', 'Renews on {date}'],
    ],
    settledSense: 'the present one',
    component: 'PlanSummary',
    file: 'src/locales/en.json',
  },
  {
    slug: 'drop',
    key: 'action.drop',
    text: 'Drop',
    senses: ['release a dragged item', 'a droplet, or to discard'],
    open: [
      ['action.move', 'Move'],
      ['action.place', 'Place'],
      ['action.set', 'Set'],
    ],
    settled: [
      ['dnd.dragStart', 'Drag to reorder'],
      ['dnd.dropHere', 'Drop here'],
      ['dnd.dragCancel', 'Cancelled'],
    ],
    settledSense: 'release a dragged item',
    component: 'DragAndDrop',
    file: 'src/locales/en.json',
  },
  {
    slug: 'field',
    key: 'label.field',
    text: 'Field',
    senses: ['a form input', 'an area of land'],
    open: [
      ['label.item', 'Item'],
      ['label.area', 'Area'],
      ['label.unit', 'Unit'],
    ],
    settled: [
      ['form.required', 'Required'],
      ['form.placeholder', 'Placeholder'],
      ['form.validation', 'Validation'],
    ],
    settledSense: 'a form input',
    component: 'FormBuilder',
    file: 'src/locales/en.json',
  },
  {
    slug: 'fire',
    key: 'action.fire',
    text: 'Fire',
    senses: ['to dismiss an employee', 'combustion'],
    open: [
      ['action.assign', 'Assign'],
      ['action.update', 'Update'],
      ['action.record', 'Record'],
    ],
    settled: [
      ['safety.smokeAlarm', 'Smoke alarm'],
      ['safety.evacuation', 'Evacuation route'],
      ['safety.extinguisher', 'Extinguisher'],
    ],
    settledSense: 'combustion',
    component: 'SafetyPanel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'key',
    key: 'label.key',
    text: 'Key',
    senses: ['a cryptographic or identifier key', 'a keyboard key'],
    open: [
      ['label.value', 'Value'],
      ['label.item', 'Item'],
      ['label.name', 'Name'],
    ],
    settled: [
      ['shortcut.modifier', 'Modifier'],
      ['shortcut.combination', 'Key combination'],
      ['shortcut.press', 'Press a key'],
    ],
    settledSense: 'a keyboard key',
    component: 'ShortcutEditor',
    file: 'src/locales/en.json',
  },
  {
    slug: 'last',
    key: 'label.last',
    text: 'Last',
    senses: ['most recent', 'final in a sequence'],
    open: [
      ['label.item', 'Item'],
      ['label.position', 'Position'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['page.first', 'First'],
      ['page.previous', 'Previous'],
      ['page.next', 'Next'],
    ],
    settledSense: 'final in a sequence',
    component: 'Pagination',
    file: 'src/locales/en.json',
  },
  {
    slug: 'mark',
    key: 'action.mark',
    text: 'Mark',
    senses: ['to flag or annotate', 'a grade or score'],
    open: [
      ['action.set', 'Set'],
      ['action.apply', 'Apply'],
      ['action.change', 'Change'],
    ],
    settled: [
      ['inbox.markRead', 'Mark as read'],
      ['inbox.markUnread', 'Mark as unread'],
      ['inbox.archive', 'Archive'],
    ],
    settledSense: 'to flag or annotate',
    component: 'Inbox',
    file: 'src/locales/en.json',
  },
  {
    slug: 'pitch',
    key: 'label.pitch',
    text: 'Pitch',
    senses: ['a presentation to investors', 'audio frequency'],
    open: [
      ['label.item', 'Item'],
      ['label.value', 'Value'],
      ['label.setting', 'Setting'],
    ],
    settled: [
      ['audio.tempo', 'Tempo'],
      ['audio.volume', 'Volume'],
      ['audio.reverb', 'Reverb'],
    ],
    settledSense: 'audio frequency',
    component: 'AudioEffects',
    file: 'src/locales/en.json',
  },
  {
    slug: 'rest',
    key: 'label.rest',
    text: 'Rest',
    senses: ['the remainder', 'to sleep or pause'],
    open: [
      ['label.value', 'Value'],
      ['label.group', 'Group'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['chart.topFive', 'Top 5'],
      ['chart.other', 'Other'],
      ['chart.total', 'Total'],
    ],
    settledSense: 'the remainder',
    component: 'ChartLegend',
    file: 'src/locales/en.json',
  },
  {
    slug: 'ring',
    key: 'label.ring',
    text: 'Ring',
    senses: ['to call by phone', 'a circular band'],
    open: [
      ['label.action', 'Action'],
      ['label.item', 'Item'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['call.answer', 'Answer'],
      ['call.decline', 'Decline'],
      ['call.missed', 'Missed call'],
    ],
    settledSense: 'to call by phone',
    component: 'CallScreen',
    file: 'src/locales/en.json',
  },
  {
    slug: 'type',
    key: 'label.type',
    text: 'Type',
    senses: ['a category', 'to enter text with a keyboard'],
    open: [
      ['label.item', 'Item'],
      ['label.field', 'Field'],
      ['label.value', 'Value'],
    ],
    settled: [
      ['filter.typeImage', 'Image'],
      ['filter.typeVideo', 'Video'],
      ['filter.typeDocument', 'Document'],
    ],
    settledSense: 'a category',
    component: 'MediaFilter',
    file: 'src/locales/en.json',
  },
  {
    slug: 'mine',
    key: 'label.mine',
    text: 'Mine',
    senses: ['belonging to me', 'an excavation site'],
    open: [
      ['label.filter', 'Filter'],
      ['label.scope', 'Scope'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['filter.all', 'All'],
      ['filter.assignedToMe', 'Assigned to me'],
      ['filter.unassigned', 'Unassigned'],
    ],
    settledSense: 'belonging to me',
    component: 'TaskFilter',
    file: 'src/locales/en.json',
  },
  {
    slug: 'park',
    key: 'action.park',
    text: 'Park',
    senses: ['to set aside temporarily', 'a public green space'],
    open: [
      ['action.hold', 'Hold'],
      ['action.defer', 'Defer'],
      ['action.item', 'Item'],
    ],
    settled: [
      ['map.parkNearby', 'Parks nearby'],
      ['map.playground', 'Playground'],
      ['map.trail', 'Trail'],
    ],
    settledSense: 'a public green space',
    component: 'MapLayers',
    file: 'src/locales/en.json',
  },
  {
    slug: 'spring',
    key: 'label.spring',
    text: 'Spring',
    senses: ['the season', 'a coiled component or animation curve'],
    open: [
      ['label.value', 'Value'],
      ['label.option', 'Option'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['easing.linear', 'Linear'],
      ['easing.easeIn', 'Ease in'],
      ['easing.bounce', 'Bounce'],
    ],
    settledSense: 'an animation curve',
    component: 'EasingPicker',
    file: 'src/locales/en.json',
  },
  {
    slug: 'stable',
    key: 'label.stable',
    text: 'Stable',
    senses: ['a release channel', 'a building for horses'],
    open: [
      ['label.value', 'Value'],
      ['label.state', 'State'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['release.beta', 'Beta'],
      ['release.canary', 'Canary'],
      ['release.channel', 'Release channel'],
    ],
    settledSense: 'a release channel',
    component: 'ReleaseChannel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'mean',
    key: 'label.mean',
    text: 'Mean',
    senses: ['the arithmetic average', 'to signify'],
    open: [
      ['label.value', 'Value'],
      ['label.result', 'Result'],
      ['label.item', 'Item'],
    ],
    settled: [
      ['stats.median', 'Median'],
      ['stats.mode', 'Mode'],
      ['stats.stdDev', 'Standard deviation'],
    ],
    settledSense: 'the arithmetic average',
    component: 'StatsSummary',
    file: 'src/locales/en.json',
  },
  {
    slug: 'race',
    key: 'label.race',
    text: 'Race',
    senses: ['a timed contest', 'a demographic category'],
    open: [
      ['label.field', 'Field'],
      ['label.value', 'Value'],
      ['label.entry', 'Entry'],
    ],
    settled: [
      ['event.startTime', 'Start time'],
      ['event.finishLine', 'Finish line'],
      ['event.lap', 'Lap'],
    ],
    settledSense: 'a timed contest',
    component: 'RaceEvent',
    file: 'src/locales/en.json',
  },
];

/* ------------------------------------------------------------------ *
 * Insufficient grammar — a bare word the target language must inflect.
 * ------------------------------------------------------------------ */

interface GrammarPair {
  slug: string;
  key: string;
  text: string;
  /** What the target language cannot determine without the noun. */
  missing: string;
  open: [string, string][];
  settled: [string, string][];
  /** The noun the settling context supplies. */
  noun: string;
  component: string;
  file: string;
}

const GRAMMAR: GrammarPair[] = [
  {
    slug: 'active',
    key: 'status.active',
    text: 'Active',
    missing: 'the gender and number of the noun it describes',
    open: [
      ['status.one', 'One'],
      ['status.two', 'Two'],
      ['status.three', 'Three'],
    ],
    settled: [
      ['user.title', 'User'],
      ['user.inactive', 'Inactive user'],
      ['user.suspended', 'Suspended user'],
    ],
    noun: 'user',
    component: 'UserStatus',
    file: 'src/locales/en.json',
  },
  {
    slug: 'selected',
    key: 'state.selected',
    text: 'Selected',
    missing: 'the gender and number of what was selected',
    open: [
      ['state.a', 'A'],
      ['state.b', 'B'],
      ['state.c', 'C'],
    ],
    settled: [
      ['file.title', 'File'],
      ['file.selectedCount', '{count} files selected'],
      ['file.deselect', 'Deselect file'],
    ],
    noun: 'file',
    component: 'FileList',
    file: 'src/locales/en.json',
  },
  {
    slug: 'required',
    key: 'validation.required',
    text: 'Required',
    missing: 'the gender of the field it labels',
    open: [
      ['validation.one', 'One'],
      ['validation.two', 'Two'],
      ['validation.three', 'Three'],
    ],
    settled: [
      ['form.fieldLabel', 'Field'],
      ['form.fieldOptional', 'Optional field'],
      ['form.fieldInvalid', 'Invalid field'],
    ],
    noun: 'field',
    component: 'FieldLabel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'deleted',
    key: 'state.deleted',
    text: 'Deleted',
    missing: 'the gender and number of what was deleted',
    open: [
      ['state.x', 'X'],
      ['state.y', 'Y'],
      ['state.z', 'Z'],
    ],
    settled: [
      ['project.title', 'Project'],
      ['project.deletedOn', 'Project deleted on {date}'],
      ['project.restore', 'Restore project'],
    ],
    noun: 'project',
    component: 'ProjectRow',
    file: 'src/locales/en.json',
  },
  {
    slug: 'saved',
    key: 'state.saved',
    text: 'Saved',
    missing: 'the gender of the saved object',
    open: [
      ['state.first', 'First'],
      ['state.second', 'Second'],
      ['state.third', 'Third'],
    ],
    settled: [
      ['draft.title', 'Draft'],
      ['draft.savedAt', 'Draft saved at {time}'],
      ['draft.discard', 'Discard draft'],
    ],
    noun: 'draft',
    component: 'DraftIndicator',
    file: 'src/locales/en.json',
  },
  {
    slug: 'locked',
    key: 'state.locked',
    text: 'Locked',
    missing: 'the gender of the locked object',
    open: [
      ['state.alpha', 'Alpha'],
      ['state.beta', 'Beta'],
      ['state.gamma', 'Gamma'],
    ],
    settled: [
      ['account.title', 'Account'],
      ['account.unlock', 'Unlock account'],
      ['account.lockedReason', 'Account locked after too many attempts'],
    ],
    noun: 'account',
    component: 'AccountBanner',
    file: 'src/locales/en.json',
  },
  {
    slug: 'shared',
    key: 'state.shared',
    text: 'Shared',
    missing: 'the gender and number of the shared item',
    open: [
      ['state.one', 'One'],
      ['state.many', 'Many'],
      ['state.none', 'None'],
    ],
    settled: [
      ['folder.title', 'Folder'],
      ['folder.sharedWith', 'Folder shared with {name}'],
      ['folder.stopSharing', 'Stop sharing folder'],
    ],
    noun: 'folder',
    component: 'FolderSharing',
    file: 'src/locales/en.json',
  },
  {
    slug: 'verified',
    key: 'state.verified',
    text: 'Verified',
    missing: 'the gender of what was verified',
    open: [
      ['state.p', 'P'],
      ['state.q', 'Q'],
      ['state.r', 'R'],
    ],
    settled: [
      ['email.title', 'Email address'],
      ['email.verifyNow', 'Verify email address'],
      ['email.unverified', 'Unverified email address'],
    ],
    noun: 'email address',
    component: 'EmailVerification',
    file: 'src/locales/en.json',
  },
  {
    slug: 'empty',
    key: 'state.empty',
    text: 'Empty',
    missing: 'the gender and number of the empty container',
    open: [
      ['state.k', 'K'],
      ['state.l', 'L'],
      ['state.m', 'M'],
    ],
    settled: [
      ['trash.title', 'Trash'],
      ['trash.emptyNow', 'Empty trash'],
      ['trash.itemCount', '{count} items in trash'],
    ],
    noun: 'trash',
    component: 'TrashPanel',
    file: 'src/locales/en.json',
  },
  {
    slug: 'archived',
    key: 'state.archived',
    text: 'Archived',
    missing: 'the gender and number of the archived item',
    open: [
      ['state.n', 'N'],
      ['state.o', 'O'],
      ['state.s', 'S'],
    ],
    settled: [
      ['conversation.title', 'Conversation'],
      ['conversation.unarchive', 'Unarchive conversation'],
      ['conversation.archivedOn', 'Conversation archived on {date}'],
    ],
    noun: 'conversation',
    component: 'ConversationRow',
    file: 'src/locales/en.json',
  },
  {
    slug: 'pending',
    key: 'state.pending',
    text: 'Pending',
    missing: 'the gender of the pending object',
    open: [
      ['state.t', 'T'],
      ['state.u', 'U'],
      ['state.v', 'V'],
    ],
    settled: [
      ['invitation.title', 'Invitation'],
      ['invitation.resend', 'Resend invitation'],
      ['invitation.revoke', 'Revoke invitation'],
    ],
    noun: 'invitation',
    component: 'InvitationList',
    file: 'src/locales/en.json',
  },
  {
    slug: 'approved',
    key: 'state.approved',
    text: 'Approved',
    missing: 'the gender of the approved object',
    open: [
      ['state.w', 'W'],
      ['state.aa', 'AA'],
      ['state.bb', 'BB'],
    ],
    settled: [
      ['request.title', 'Request'],
      ['request.rejectedReason', 'Request rejected'],
      ['request.pendingReview', 'Request awaiting review'],
    ],
    noun: 'request',
    component: 'RequestStatus',
    file: 'src/locales/en.json',
  },
  {
    slug: 'blocked',
    key: 'state.blocked',
    text: 'Blocked',
    missing: 'the gender and number of who is blocked',
    open: [
      ['state.cc', 'CC'],
      ['state.dd', 'DD'],
      ['state.ee', 'EE'],
    ],
    settled: [
      ['member.title', 'Member'],
      ['member.unblock', 'Unblock member'],
      ['member.blockedOn', 'Member blocked on {date}'],
    ],
    noun: 'member',
    component: 'MemberRow',
    file: 'src/locales/en.json',
  },
  {
    slug: 'private',
    key: 'visibility.private',
    text: 'Private',
    missing: 'the gender of the thing whose visibility it describes',
    open: [
      ['visibility.ff', 'FF'],
      ['visibility.gg', 'GG'],
      ['visibility.hh', 'HH'],
    ],
    settled: [
      ['repository.title', 'Repository'],
      ['repository.makePublic', 'Make repository public'],
      ['repository.visibility', 'Repository visibility'],
    ],
    noun: 'repository',
    component: 'VisibilityToggle',
    file: 'src/locales/en.json',
  },
  {
    slug: 'unread',
    key: 'state.unread',
    text: 'Unread',
    missing: 'the gender and number of the unread items',
    open: [
      ['state.ii', 'II'],
      ['state.jj', 'JJ'],
      ['state.kk', 'KK'],
    ],
    settled: [
      ['message.title', 'Message'],
      ['message.markAllRead', 'Mark all messages as read'],
      ['message.unreadCount', '{count} unread messages'],
    ],
    noun: 'message',
    component: 'MessageBadge',
    file: 'src/locales/en.json',
  },
  {
    slug: 'complete',
    key: 'state.complete',
    text: 'Complete',
    missing: 'the gender of what is complete',
    open: [
      ['state.ll', 'LL'],
      ['state.mm', 'MM'],
      ['state.nn', 'NN'],
    ],
    settled: [
      ['task.title', 'Task'],
      ['task.markIncomplete', 'Mark task incomplete'],
      ['task.completedOn', 'Task completed on {date}'],
    ],
    noun: 'task',
    component: 'TaskItem',
    file: 'src/locales/en.json',
  },
  {
    slug: 'hidden',
    key: 'state.hidden',
    text: 'Hidden',
    missing: 'the gender and number of what is hidden',
    open: [
      ['state.oo', 'OO'],
      ['state.pp', 'PP'],
      ['state.qq', 'QQ'],
    ],
    settled: [
      ['column.title', 'Column'],
      ['column.showColumn', 'Show column'],
      ['column.hiddenCount', '{count} hidden columns'],
    ],
    noun: 'column',
    component: 'ColumnManager',
    file: 'src/locales/en.json',
  },
  {
    slug: 'muted',
    key: 'state.muted',
    text: 'Muted',
    missing: 'the gender of what is muted',
    open: [
      ['state.rr', 'RR'],
      ['state.ss', 'SS'],
      ['state.tt', 'TT'],
    ],
    settled: [
      ['channel.title', 'Channel'],
      ['channel.unmute', 'Unmute channel'],
      ['channel.notifications', 'Channel notifications'],
    ],
    noun: 'channel',
    component: 'ChannelSettings',
    file: 'src/locales/en.json',
  },
  {
    slug: 'failed',
    key: 'state.failed',
    text: 'Failed',
    missing: 'the gender and number of what failed',
    open: [
      ['state.uu', 'UU'],
      ['state.vv', 'VV'],
      ['state.ww', 'WW'],
    ],
    settled: [
      ['payment.title', 'Payment'],
      ['payment.retry', 'Retry payment'],
      ['payment.failedReason', 'Payment declined by the bank'],
    ],
    noun: 'payment',
    component: 'PaymentStatus',
    file: 'src/locales/en.json',
  },
  {
    slug: 'ready',
    key: 'state.ready',
    text: 'Ready',
    missing: 'the gender of what is ready',
    open: [
      ['state.xx', 'XX'],
      ['state.yy', 'YY'],
      ['state.zz', 'ZZ'],
    ],
    settled: [
      ['export.title', 'Export'],
      ['export.download', 'Download export'],
      ['export.preparing', 'Preparing export'],
    ],
    noun: 'export',
    component: 'ExportStatus',
    file: 'src/locales/en.json',
  },
  {
    slug: 'public',
    key: 'visibility.public',
    text: 'Public',
    missing: 'the gender of the thing whose visibility it describes',
    open: [
      ['visibility.ab', 'AB'],
      ['visibility.cd', 'CD'],
      ['visibility.ef', 'EF'],
    ],
    settled: [
      ['dashboard.title', 'Dashboard'],
      ['dashboard.makePrivate', 'Make dashboard private'],
      ['dashboard.shareLink', 'Dashboard share link'],
    ],
    noun: 'dashboard',
    component: 'DashboardVisibility',
    file: 'src/locales/en.json',
  },
  {
    slug: 'expired',
    key: 'state.expired',
    text: 'Expired',
    missing: 'the gender of what expired',
    open: [
      ['state.gh', 'GH'],
      ['state.ij', 'IJ'],
      ['state.kl', 'KL'],
    ],
    settled: [
      ['token.title', 'Token'],
      ['token.regenerate', 'Regenerate token'],
      ['token.expiresOn', 'Token expires on {date}'],
    ],
    noun: 'token',
    component: 'TokenList',
    file: 'src/locales/en.json',
  },
  {
    slug: 'draft',
    key: 'state.draft',
    text: 'Draft',
    missing: 'the gender of the item in draft state',
    open: [
      ['state.mn', 'MN'],
      ['state.op', 'OP'],
      ['state.qr', 'QR'],
    ],
    settled: [
      ['article.title', 'Article'],
      ['article.publish', 'Publish article'],
      ['article.lastEdited', 'Article last edited {date}'],
    ],
    noun: 'article',
    component: 'ArticleStatus',
    file: 'src/locales/en.json',
  },
  {
    slug: 'default',
    key: 'state.default',
    text: 'Default',
    missing: 'the gender of what it is the default of',
    open: [
      ['state.st', 'ST'],
      ['state.uv', 'UV'],
      ['state.wx', 'WX'],
    ],
    settled: [
      ['branch.title', 'Branch'],
      ['branch.setDefault', 'Set as default branch'],
      ['branch.protected', 'Protected branch'],
    ],
    noun: 'branch',
    component: 'BranchSettings',
    file: 'src/locales/en.json',
  },
  {
    slug: 'custom',
    key: 'state.custom',
    text: 'Custom',
    missing: 'the gender and number of what is customised',
    open: [
      ['state.yz', 'YZ'],
      ['state.za', 'ZA'],
      ['state.zb', 'ZB'],
    ],
    settled: [
      ['domain.title', 'Domain'],
      ['domain.addCustom', 'Add custom domain'],
      ['domain.verifyDns', 'Verify domain DNS'],
    ],
    noun: 'domain',
    component: 'DomainSettings',
    file: 'src/locales/en.json',
  },
];

/* ------------------------------------------------------------------ *
 * Register — formality the target language must choose, and cannot infer.
 * ------------------------------------------------------------------ */

interface RegisterPair {
  slug: string;
  key: string;
  text: string;
  open: [string, string][];
  settled: [string, string][];
  /** What the settling siblings establish. */
  establishes: string;
  component: string;
  file: string;
}

const FORMAL_SIBLINGS: [string, string][] = [
  ['legal.terms', 'By continuing you accept the Terms of Service.'],
  ['legal.dpa', 'Your organisation has signed a Data Processing Agreement.'],
  ['legal.contact', 'Please contact your account manager for assistance.'],
];

const CASUAL_SIBLINGS: [string, string][] = [
  ['onboarding.hey', 'Hey there! 👋'],
  ['onboarding.nice', "Nice — that's the hard part done."],
  ['onboarding.grab', 'Grab a coffee, this takes a minute.'],
];

const REGISTER: RegisterPair[] = [
  {
    slug: 'are-you-sure',
    key: 'confirm.areYouSure',
    text: 'Are you sure?',
    open: [
      ['confirm.title', 'Confirm'],
      ['confirm.ok', 'OK'],
      ['confirm.cancel', 'Cancel'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'ConfirmDialog',
    file: 'src/locales/en.json',
  },
  {
    slug: 'sign-in-continue',
    key: 'auth.signInToContinue',
    text: 'Sign in to continue',
    open: [
      ['auth.title', 'Sign in'],
      ['auth.email', 'Email'],
      ['auth.password', 'Password'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'AuthGate',
    file: 'src/locales/en.json',
  },
  {
    slug: 'unsaved-changes',
    key: 'editor.unsavedChanges',
    text: 'You have unsaved changes',
    open: [
      ['editor.title', 'Editor'],
      ['editor.save', 'Save'],
      ['editor.discard', 'Discard'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'EditorWarning',
    file: 'src/locales/en.json',
  },
  {
    slug: 'want-to-delete',
    key: 'confirm.wantToDelete',
    text: 'Do you want to delete this?',
    open: [
      ['confirm.yes', 'Yes'],
      ['confirm.no', 'No'],
      ['confirm.later', 'Later'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'DeleteConfirm',
    file: 'src/locales/en.json',
  },
  {
    slug: 'welcome-back',
    key: 'auth.welcomeBack',
    text: 'Welcome back!',
    open: [
      ['auth.hello', 'Hello'],
      ['auth.account', 'Account'],
      ['auth.session', 'Session'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'WelcomeBanner',
    file: 'src/locales/en.json',
  },
  {
    slug: 'enter-your-email',
    key: 'form.enterYourEmail',
    text: 'Enter your email',
    open: [
      ['form.field', 'Field'],
      ['form.submit', 'Submit'],
      ['form.reset', 'Reset'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'EmailField',
    file: 'src/locales/en.json',
  },
  {
    slug: 'check-your-inbox',
    key: 'auth.checkYourInbox',
    text: 'Check your inbox',
    open: [
      ['auth.sent', 'Sent'],
      ['auth.resend', 'Resend'],
      ['auth.status', 'Status'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'MagicLinkSent',
    file: 'src/locales/en.json',
  },
  {
    slug: 'try-again',
    key: 'error.tryAgain',
    text: 'Try again',
    open: [
      ['error.title', 'Error'],
      ['error.code', 'Code'],
      ['error.details', 'Details'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'ErrorState',
    file: 'src/locales/en.json',
  },
  {
    slug: 'tell-us',
    key: 'feedback.tellUs',
    text: 'Tell us what you think',
    open: [
      ['feedback.title', 'Feedback'],
      ['feedback.send', 'Send'],
      ['feedback.rating', 'Rating'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'FeedbackPrompt',
    file: 'src/locales/en.json',
  },
  {
    slug: 'youre-all-set',
    key: 'onboarding.allSet',
    text: "You're all set",
    open: [
      ['onboarding.step', 'Step'],
      ['onboarding.next', 'Next'],
      ['onboarding.done', 'Done'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'OnboardingComplete',
    file: 'src/locales/en.json',
  },
  {
    slug: 'choose-a-plan',
    key: 'billing.choosePlan',
    text: 'Choose a plan',
    open: [
      ['billing.title', 'Billing'],
      ['billing.invoice', 'Invoice'],
      ['billing.method', 'Payment method'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'PlanChooser',
    file: 'src/locales/en.json',
  },
  {
    slug: 'invite-your-team',
    key: 'team.inviteYourTeam',
    text: 'Invite your team',
    open: [
      ['team.title', 'Team'],
      ['team.members', 'Members'],
      ['team.roles', 'Roles'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'TeamInvite',
    file: 'src/locales/en.json',
  },
  {
    slug: 'couldnt-find-account',
    key: 'auth.accountNotFound',
    text: "We couldn't find your account",
    open: [
      ['auth.error', 'Error'],
      ['auth.retry', 'Retry'],
      ['auth.support', 'Support'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'AccountLookup',
    file: 'src/locales/en.json',
  },
  {
    slug: 'confirm-your-password',
    key: 'auth.confirmYourPassword',
    text: 'Confirm your password',
    open: [
      ['auth.password', 'Password'],
      ['auth.strength', 'Strength'],
      ['auth.show', 'Show'],
    ],
    settled: CASUAL_SIBLINGS,
    establishes: 'a casual, consumer register',
    component: 'PasswordConfirm',
    file: 'src/locales/en.json',
  },
  {
    slug: 'lets-get-started',
    key: 'onboarding.getStarted',
    text: "Let's get started",
    open: [
      ['onboarding.title', 'Setup'],
      ['onboarding.skip', 'Skip'],
      ['onboarding.back', 'Back'],
    ],
    settled: FORMAL_SIBLINGS,
    establishes: 'a formal, enterprise register',
    component: 'GetStarted',
    file: 'src/locales/en.json',
  },
];

/**
 * The corpus, built deterministically.
 *
 * Locales are assigned round-robin rather than chosen per case. Choosing
 * would let an unconscious preference — picking the locale where a case
 * "works best" — inflate the score, and the assignment being mechanical is
 * what makes that impossible to do by accident. Grammar and register cases
 * draw from restricted pools, because a bare adjective is only underdetermined
 * in a language that inflects it, and a formality choice only exists where the
 * language forces one.
 */
export function buildAmbiguityCases(): AmbiguityCase[] {
  const cases: AmbiguityCase[] = [];

  POLYSEMY.forEach((pair, index) => {
    const locale = LOCALES[index % LOCALES.length] as TargetLocale;
    cases.push(
      ...expand(
        pair,
        'polysemy',
        locale,
        `"${pair.text}" can mean ${pair.senses[0]} or ${pair.senses[1]}, and the sibling keys are generic labels that pick neither.`,
        `The sibling keys are ${pair.settled
          .map(([k]) => k)
          .join(', ')}, which settle it on ${pair.settledSense}.`,
      ),
    );
  });

  GRAMMAR.forEach((pair, index) => {
    const locale = AGREEMENT_LOCALES[
      index % AGREEMENT_LOCALES.length
    ] as TargetLocale;
    cases.push(
      ...expand(
        {
          slug: pair.slug,
          key: pair.key,
          text: pair.text,
          senses: ['', ''],
          open: pair.open,
          settled: pair.settled,
          settledSense: pair.noun,
          component: pair.component,
          file: pair.file,
        },
        'insufficient-grammar',
        locale,
        `"${pair.text}" stands alone and ${locale} needs ${pair.missing}; the sibling keys are placeholders that supply no noun.`,
        `The sibling keys name the noun — ${pair.noun} — so the agreement is determined.`,
      ),
    );
  });

  REGISTER.forEach((pair, index) => {
    const locale = REGISTER_LOCALES[
      index % REGISTER_LOCALES.length
    ] as TargetLocale;
    cases.push(
      ...expand(
        {
          slug: pair.slug,
          key: pair.key,
          text: pair.text,
          senses: ['', ''],
          open: pair.open,
          settled: pair.settled,
          settledSense: pair.establishes,
          component: pair.component,
          file: pair.file,
        },
        'register',
        locale,
        `"${pair.text}" addresses the user directly and ${locale} forces a formality choice; the sibling keys are neutral labels that establish no voice.`,
        `The sibling keys establish ${pair.establishes}, which settles the formality.`,
      ),
    );
  });

  return cases;
}
