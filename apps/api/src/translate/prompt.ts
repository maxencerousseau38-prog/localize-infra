import type { TranslateBatchRequest } from '@localize-infra/schemas';
import type { TranslateRequest } from '../router/types.js';

/**
 * The instruction that makes invariant 4 real.
 *
 * "The agent raises ambiguities, it does not guess" is only a property of the
 * system if the model is given somewhere to put an uncertainty. Before this,
 * the response shape had two fields and no way to say "I do not know", so a
 * coin-flip between two readings was returned in exactly the same shape as a
 * certainty — and shipped as one.
 *
 * The escalation bar is set deliberately high. A queue that raises every
 * second string is a queue nobody reads, and the failure mode of this feature
 * is not "missed an ambiguity" but "cried wolf until it was ignored". So the
 * criteria are concrete and few: a word with two genuinely different senses
 * where the code does not settle which, a string too short to carry its own
 * grammar, and formality that changes the wording with no cue for which to
 * pick.
 */
const INSTRUCTIONS = [
  'You are a professional software localization translator.',
  'Translate each UI string in the given JSON array from English to the target locale.',
  'Preserve any placeholders or interpolation syntax exactly as they appear (e.g. %s, {{variable}}, {variable}, ICU plural/select blocks).',
  'Use the file path, component name, and surrounding code as context for tone and terminology.',
  '',
  'For each string decide whether the context settles its meaning.',
  'Set "confidence" to "confident" when it does.',
  'Set "confidence" to "ambiguous" ONLY when a competent human translator would have to ask the developer a question, specifically when:',
  '- the English word has two genuinely different senses and the surrounding code does not settle which is meant (e.g. "Home" as a navigation destination vs a dwelling, "Post" as a verb vs a noun);',
  '- the string is too short to carry the grammatical information the target language requires (e.g. a bare adjective whose gender or number depends on a noun that is not present);',
  '- the register is undetermined and the target language forces a choice that changes the wording (e.g. German du/Sie, French tu/vous).',
  'Do NOT mark a string ambiguous merely because several good translations exist. Pick the best one and stay confident.',
  '',
  'When "confidence" is "ambiguous" you MUST also provide:',
  '- "question": one sentence, addressed to the developer, naming exactly what you need to know;',
  '- "alternatives": two or more objects with "text" (the translation under that reading) and "rationale" (what distinguishes it).',
  'Still provide your best "text" for an ambiguous string; it is a proposal awaiting confirmation, not a blank.',
  '',
  'Respond with ONLY a JSON array of objects, one per input string, each with "key", "text", "confidence", and — when ambiguous — "question" and "alternatives".',
  'No markdown code fences, no explanation outside the array.',
].join('\n');

export function buildBatchPrompt(
  request: TranslateBatchRequest,
): TranslateRequest {
  const items = request.strings.map((s) => ({
    key: s.key,
    text: s.text,
    filePath: s.filePath,
    componentName: s.componentName,
    surroundingCode: s.surroundingCode,
  }));
  return {
    systemPrompt: `${INSTRUCTIONS}\nTarget locale: ${request.targetLocale}`,
    userPrompt: JSON.stringify(items, null, 2),
  };
}
