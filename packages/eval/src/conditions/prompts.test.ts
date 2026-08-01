import type { CorpusEntry, GlossaryEntry } from '@localize-infra/schemas';
import { describe, expect, it } from 'vitest';
import { buildConditionAPrompt, buildConditionBPrompt } from './prompts.js';

const entry: CorpusEntry = {
  id: 'x',
  sourceProject: 'excalidraw',
  sourceLicense: 'MIT',
  sourceRepoUrl: 'https://github.com/excalidraw/excalidraw',
  sourceCommit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
  filePath: 'packages/excalidraw/locales/en.json',
  surroundingCode: '"paste": "Paste",\n"copy": "Copy"',
  componentName: 'labels',
  icuStructure: null,
  sourceText: 'Delete {{count}} item(s) from GitHub?',
  targetLocale: 'de',
  humanReference: 'ignored',
  maxLength: 60,
};

const glossary: GlossaryEntry[] = [
  { term: 'GitHub', translations: { de: 'GitHub' } },
];

describe('buildConditionAPrompt', () => {
  it('contains only the source text, target locale, and preservation instructions — no file/component/glossary context', () => {
    const req = buildConditionAPrompt(entry);
    expect(req.userPrompt).toBe('Delete {{count}} item(s) from GitHub?');
    expect(req.systemPrompt).toContain('de');
    expect(req.systemPrompt).not.toContain('labels');
    expect(req.systemPrompt).not.toContain('GitHub-Konto');
  });
});

describe('buildConditionBPrompt', () => {
  it('includes file path, component name, surrounding code, glossary, and length constraint', () => {
    const req = buildConditionBPrompt(entry, glossary);
    expect(req.systemPrompt).toContain('packages/excalidraw/locales/en.json');
    expect(req.systemPrompt).toContain('labels');
    expect(req.systemPrompt).toContain('"paste": "Paste"');
    expect(req.systemPrompt).toContain('GitHub -> GitHub');
    expect(req.systemPrompt).toContain('60');
    expect(req.userPrompt).toBe('Delete {{count}} item(s) from GitHub?');
  });
});
