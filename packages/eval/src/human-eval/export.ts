import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CorpusEntrySchema, TranslationResultSchema } from '@localize-infra/schemas'
import { generateComparisonTasks } from './generate.js'

const DATA_DIR = join(process.cwd(), 'src/corpus/data')
const EXPORT_DIR = join(process.cwd(), 'src/human-eval/export')

function csvField(value: string): string {
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function tasksToCsv(tasks: { id: string; targetLocale: string; pairType: string; left: string; right: string }[]): string {
  const header = 'id,targetLocale,pairType,left,right'
  const rows = tasks.map((t) => `${t.id},${t.targetLocale},${t.pairType},${csvField(t.left)},${csvField(t.right)}`)
  return [header, ...rows].join('\n') + '\n'
}

function deterministicShuffle(taskId: string): boolean {
  let hash = 0
  for (const char of taskId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 2 === 0
}

function main(): void {
  const entries = (JSON.parse(readFileSync(join(DATA_DIR, 'entries.json'), 'utf-8')) as unknown[]).map((e) =>
    CorpusEntrySchema.parse(e),
  )
  const translations = (JSON.parse(readFileSync(join(DATA_DIR, 'translations.json'), 'utf-8')) as unknown[]).map((t) =>
    TranslationResultSchema.parse(t),
  )
  const tasks = generateComparisonTasks(entries, translations, deterministicShuffle)

  mkdirSync(EXPORT_DIR, { recursive: true })
  writeFileSync(join(EXPORT_DIR, 'tasks.json'), JSON.stringify(tasks, null, 2))
  writeFileSync(join(EXPORT_DIR, 'tasks.csv'), tasksToCsv(tasks))
  console.log(`${tasks.length} comparison tasks exported to ${EXPORT_DIR}`)
}

const invokedPath = process.argv[1]?.replace(/\\/g, '/')
const modulePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (invokedPath === modulePath) {
  main()
}
