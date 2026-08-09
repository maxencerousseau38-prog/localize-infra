/**
 * The pipeline — the product's visual identity, stated once (DESIGN.md §1.4).
 *
 * A run is a walk through five stages, bounded by your repository at one end
 * and locale files plus a pull request at the other. The repository and the
 * files are not stages; they are what the pipeline reads and what it leaves
 * behind, and conflating the two is what let three different vocabularies grow:
 * the application drew five stages, the marketing site named three, and the
 * design document listed eight.
 *
 * Every surface that expresses where a run is must name the stages from here.
 * Collapsing stages for a smaller surface is a presentation choice and is
 * fine — inventing a different name for one is not, because the word a reader
 * learns on the landing page has to be the word they see in the product.
 *
 * This lives in `packages/ui` because it is shared by both applications, and it
 * is data rather than a component so the marketing site can group and re-word
 * the prose around it without reimplementing the sequence.
 */

export type PipelineStageId =
  | 'detect'
  | 'extract'
  | 'translate'
  | 'escalate'
  | 'pull-request';

export type PipelineStage = {
  id: PipelineStageId;
  /** The canonical name. Used verbatim in the application. */
  name: string;
  /** What the stage does, in one clause. */
  summary: string;
  /** What the reader has after it, if it produces something durable. */
  artifact?: string;
};

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: 'detect',
    name: 'Detect',
    summary: 'Identify the framework and where its UI copy lives',
  },
  {
    id: 'extract',
    name: 'Extract',
    summary: 'Walk the AST for hardcoded strings, not a regular expression',
    artifact: 'locales/en.json',
  },
  {
    id: 'translate',
    name: 'Translate',
    summary:
      'Send each string with its file path, component and surrounding code',
    artifact: 'One file per target locale',
  },
  {
    id: 'escalate',
    name: 'Escalate',
    summary: 'Report what is genuinely ambiguous instead of guessing at it',
  },
  {
    id: 'pull-request',
    name: 'Pull request',
    summary: 'One branch, one commit per run, touching only your locale files',
    artifact: 'A pull request you review like any other',
  },
] as const;

/** The canonical name for a stage. Throws on an unknown id by construction. */
export const PIPELINE_STAGE_NAMES: Record<PipelineStageId, string> =
  Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage.id, stage.name]),
  ) as Record<PipelineStageId, string>;
