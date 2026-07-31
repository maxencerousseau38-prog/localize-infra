import { describe, expect, it } from 'vitest'
import { extractPoLocaleStrings } from './gettext-locale.js'

const enPo = Buffer.from(`msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Not allowed for guest users"
msgstr ""

msgid "Invalid organization"
msgstr ""

msgid "{secs}{nbsp}second"
msgid_plural "{secs}{nbsp}seconds"
msgstr[0] ""
msgstr[1] ""
`)

const dePo = Buffer.from(`msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Not allowed for guest users"
msgstr "Nicht erlaubt für Gastnutzer"

msgid "Invalid organization"
msgstr ""

msgid "{secs}{nbsp}second"
msgid_plural "{secs}{nbsp}seconds"
msgstr[0] "{secs}{nbsp}Sekunde"
msgstr[1] "{secs}{nbsp}Sekunden"
`)

describe('extractPoLocaleStrings', () => {
  it('pairs translated singular entries, using the msgid as both key and source text', () => {
    expect(extractPoLocaleStrings(enPo, dePo)).toEqual([
      {
        key: 'Not allowed for guest users',
        sourceText: 'Not allowed for guest users',
        humanReference: 'Nicht erlaubt für Gastnutzer',
      },
    ])
  })

  it('skips entries with an empty msgstr in the target file', () => {
    const extracted = extractPoLocaleStrings(enPo, dePo)
    expect(extracted.find((e) => e.key === 'Invalid organization')).toBeUndefined()
  })

  it('skips plural entries (msgid_plural present)', () => {
    const extracted = extractPoLocaleStrings(enPo, dePo)
    expect(extracted.find((e) => e.key.includes('second'))).toBeUndefined()
  })
})
