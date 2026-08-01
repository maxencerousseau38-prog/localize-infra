import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ComparisonTaskSchema, type ComparisonJudgment, type ComparisonTask } from '@localize-infra/schemas'
import { parseJudgmentsFile } from '../human-eval/import.js'
import { computeGate, type LocaleResult } from './gate.js'

const EXPORT_DIR = join(process.cwd(), 'src/human-eval/export')
const REPORTS_DIR = join(process.cwd(), 'reports')

function resolvedPreference(task: ComparisonTask, judgment: ComparisonJudgment): 'B' | 'C' | 'equivalent' {
  if (judgment.preferred === 'equivalent') return 'equivalent'
  const condition = judgment.preferred === 'left' ? task.leftIsCondition : task.rightIsCondition
  return condition === 'B' ? 'B' : 'C'
}

export function buildReport(
  tasks: ComparisonTask[],
  judgments: ComparisonJudgment[],
): { markdownByLocale: Map<string, string>; gate: ReturnType<typeof computeGate> } {
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const byLocale = new Map<string, { bWins: number; equivalent: number; cWins: number; total: number }>()

  for (const judgment of judgments) {
    const task = tasksById.get(judgment.taskId)
    if (!task || task.pairType !== 'B_vs_C') continue
    const locale = task.targetLocale
    const counts = byLocale.get(locale) ?? { bWins: 0, equivalent: 0, cWins: 0, total: 0 }
    const resolved = resolvedPreference(task, judgment)
    if (resolved === 'B') counts.bWins++
    else if (resolved === 'equivalent') counts.equivalent++
    else counts.cWins++
    counts.total++
    byLocale.set(locale, counts)
  }

  const gateInput = new Map<string, LocaleResult>()
  const markdownByLocale = new Map<string, string>()
  for (const [locale, counts] of byLocale) {
    const bPreferredOrEquivalent = counts.bWins + counts.equivalent
    const rate = counts.total > 0 ? bPreferredOrEquivalent / counts.total : 0
    gateInput.set(locale, { bPreferredOrEquivalentRate: rate })
    markdownByLocale.set(
      locale,
      [
        `# Rapport — ${locale}`,
        '',
        `B_vs_C : ${bPreferredOrEquivalent}/${counts.total} préféré-ou-équivalent (${(rate * 100).toFixed(1)}%)`,
        `- B préféré : ${counts.bWins}`,
        `- Équivalent : ${counts.equivalent}`,
        `- C (référence humaine) préféré : ${counts.cWins}`,
      ].join('\n'),
    )
  }

  return { markdownByLocale, gate: computeGate(gateInput) }
}

function main(): void {
  const tasks = (JSON.parse(readFileSync(join(EXPORT_DIR, 'tasks.json'), 'utf-8')) as unknown[]).map((t) =>
    ComparisonTaskSchema.parse(t),
  )
  const judgments = parseJudgmentsFile(readFileSync(join(EXPORT_DIR, 'judgments.json'), 'utf-8'))
  const { markdownByLocale, gate } = buildReport(tasks, judgments)

  mkdirSync(REPORTS_DIR, { recursive: true })
  for (const [locale, markdown] of markdownByLocale) {
    writeFileSync(join(REPORTS_DIR, `${locale}.md`), markdown)
  }
  console.log(`Gate ${gate.passed ? 'PASSED' : 'FAILED'} — passing locales: ${gate.passingLocales.join(', ') || 'none'}`)
}

// Windows guard fix: normalize paths to forward slashes before comparison
const invokedPath = process.argv[1]?.replace(/\\/g, '/')
const modulePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (invokedPath === modulePath) {
  main()
}
