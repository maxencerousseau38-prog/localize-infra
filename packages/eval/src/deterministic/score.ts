import type {
  CorpusEntry,
  DeterministicScore,
  GlossaryEntry,
  TranslationResult,
} from '@localize-infra/schemas';
import { checkGlossaryConsistency } from './glossary.js';
import { isIcuMessage, validateIcu } from './icu.js';
import { lengthOverflow } from './length.js';
import { placeholdersIntact } from './placeholders.js';
import { pluralCategoriesCorrect } from './plurals.js';

export function scoreTranslation(
  entry: CorpusEntry,
  result: TranslationResult,
  glossary: GlossaryEntry[],
): DeterministicScore {
  const sourceIsIcu = isIcuMessage(entry.sourceText);

  return {
    corpusEntryId: entry.id,
    condition: result.condition,
    placeholderIntact: placeholdersIntact(entry.sourceText, result.text),
    icuValid: sourceIsIcu ? validateIcu(result.text) : true,
    pluralCategoriesCorrect:
      sourceIsIcu && validateIcu(result.text)
        ? pluralCategoriesCorrect(result.text, entry.targetLocale)
        : null,
    lengthOverflow: lengthOverflow(result.text, entry.maxLength),
    glossaryHits: checkGlossaryConsistency(
      entry.sourceText,
      result.text,
      entry.targetLocale,
      glossary,
    ),
  };
}
