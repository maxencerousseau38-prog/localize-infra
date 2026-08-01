import type {
  ComparisonTask,
  CorpusEntry,
  TranslationResult,
} from '@localize-infra/schemas';

function buildTask(
  entry: CorpusEntry,
  condition: 'A' | 'B',
  modelText: string,
  shouldSwap: boolean,
): ComparisonTask {
  const pairType = condition === 'A' ? 'A_vs_C' : 'B_vs_C';
  const [leftIsCondition, left, rightIsCondition, right] = shouldSwap
    ? (['C', entry.humanReference, condition, modelText] as const)
    : ([condition, modelText, 'C', entry.humanReference] as const);

  return {
    id: `${entry.id}-${pairType}`,
    corpusEntryId: entry.id,
    targetLocale: entry.targetLocale,
    pairType,
    left,
    right,
    leftIsCondition,
    rightIsCondition,
  };
}

export function generateComparisonTasks(
  entries: CorpusEntry[],
  translations: TranslationResult[],
  shouldSwap: (taskId: string) => boolean,
): ComparisonTask[] {
  const byEntryAndCondition = new Map<string, TranslationResult>();
  for (const t of translations) {
    if (t.error === null)
      byEntryAndCondition.set(`${t.corpusEntryId}-${t.condition}`, t);
  }

  const tasks: ComparisonTask[] = [];
  for (const entry of entries) {
    for (const condition of ['A', 'B'] as const) {
      const translation = byEntryAndCondition.get(`${entry.id}-${condition}`);
      if (!translation) continue;
      const taskId = `${entry.id}-${condition === 'A' ? 'A_vs_C' : 'B_vs_C'}`;
      tasks.push(
        buildTask(entry, condition, translation.text, shouldSwap(taskId)),
      );
    }
  }
  return tasks;
}
