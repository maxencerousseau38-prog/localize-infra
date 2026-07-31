import gettextParser from 'gettext-parser'

interface PoTranslation {
  msgid: string
  msgid_plural?: string
  msgstr: string[]
}

interface ParsedPo {
  translations: Record<string, Record<string, PoTranslation>>
}

function flattenPoTranslations(buffer: Buffer): Map<string, PoTranslation> {
  const parsed = gettextParser.po.parse(buffer) as ParsedPo
  const flat = new Map<string, PoTranslation>()
  for (const context of Object.values(parsed.translations)) {
    for (const [msgid, entry] of Object.entries(context)) {
      if (msgid === '') continue
      flat.set(msgid, entry)
    }
  }
  return flat
}

export interface ExtractedString {
  key: string
  sourceText: string
  humanReference: string
}

export function extractPoLocaleStrings(sourceBuffer: Buffer, targetBuffer: Buffer): ExtractedString[] {
  const source = flattenPoTranslations(sourceBuffer)
  const target = flattenPoTranslations(targetBuffer)
  const extracted: ExtractedString[] = []
  for (const [msgid, sourceEntry] of source) {
    if (sourceEntry.msgid_plural) continue
    const targetEntry = target.get(msgid)
    const humanReference = targetEntry?.msgstr[0]
    if (targetEntry && !targetEntry.msgid_plural && humanReference) {
      extracted.push({ key: msgid, sourceText: msgid, humanReference })
    }
  }
  return extracted
}
