import { relative } from 'node:path';
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';
import type { ExtractedString } from './types.js';

const TRANSLATION_CALL_NAME_PATTERN = /^(t|translate|i18n)$/i;
const UI_TEXT_ATTRIBUTES = new Set([
  'placeholder',
  'alt',
  'title',
  'aria-label',
]);
const MIN_TEXT_LENGTH = 2;
const CONTEXT_LINES_BEFORE = 3;
const CONTEXT_LINES_AFTER = 2;
// Purely numeric/punctuation/currency text (e.g. "42", "$9.99", "12%") is
// not translatable UI copy, just data — filter it out.
const NUMERIC_ONLY_PATTERN = /^[\d\s.,%$€-]+$/;
// A bare HTML entity (e.g. "&nbsp;", "&amp;") is layout filler, not text
// that needs translation.
const HTML_ENTITY_ONLY_PATTERN = /^&[a-z]+;$/i;
// Test/spec/story files contain fixture and story text that should never
// end up in the real extracted catalog.
const TEST_OR_STORY_FILE_PATTERN = /\.(test|spec|stories)\.[jt]sx?$/i;

function looksLikeUiText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) return false;
  if (NUMERIC_ONLY_PATTERN.test(trimmed)) return false;
  if (HTML_ENTITY_ONLY_PATTERN.test(trimmed)) return false;
  const hasNoSpaces = !trimmed.includes(' ');
  // Class names/identifiers are kebab-case or snake_case (contain a hyphen or
  // underscore); a single Title-Case or lowercase word like "Dashboard" or
  // "Cancel" is plain prose and must not be filtered out.
  const looksLikeIdentifierOrClassList =
    hasNoSpaces && /[-_]/.test(trimmed) && /^[a-z0-9_-]+$/i.test(trimmed);
  return !looksLikeIdentifierOrClassList;
}

function isInsideTranslationCall(node: Node): boolean {
  const call = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
  if (!call) return false;
  const calleeName = call.getExpression().getText().split('.').pop() ?? '';
  return TRANSLATION_CALL_NAME_PATTERN.test(calleeName);
}

function enclosingComponentName(node: Node): string | null {
  const fn = node.getFirstAncestor(
    (a) =>
      a.getKind() === SyntaxKind.FunctionDeclaration ||
      a.getKind() === SyntaxKind.VariableDeclaration,
  );
  if (!fn) return null;
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return fn.asKindOrThrow(SyntaxKind.FunctionDeclaration).getName() ?? null;
  }
  return fn.asKindOrThrow(SyntaxKind.VariableDeclaration).getName();
}

function surroundingCode(node: Node): string {
  const startLine = node.getStartLineNumber();
  const allLines = node.getSourceFile().getFullText().split('\n');
  const from = Math.max(0, startLine - 1 - CONTEXT_LINES_BEFORE);
  const to = Math.min(allLines.length, startLine + CONTEXT_LINES_AFTER);
  return allLines.slice(from, to).join('\n');
}

function keyFor(filePath: string, text: string): string {
  const slug =
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'text';
  const fileStem = filePath
    .replace(/\\/g, '/')
    .replace(/\.(tsx?|jsx?)$/, '')
    .replace(/\//g, '.');
  return `${fileStem}.${slug}`;
}

function extractFromSourceFile(
  sourceFile: SourceFile,
  rootDir: string,
): ExtractedString[] {
  const results: ExtractedString[] = [];
  const filePath = relative(rootDir, sourceFile.getFilePath()).replace(
    /\\/g,
    '/',
  );

  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.JsxText) {
      const text = node.getText();
      if (!looksLikeUiText(text) || isInsideTranslationCall(node)) return;
      results.push({
        key: keyFor(filePath, text),
        text: text.trim(),
        filePath,
        componentName: enclosingComponentName(node),
        surroundingCode: surroundingCode(node),
      });
      return;
    }

    if (node.getKind() === SyntaxKind.JsxAttribute) {
      const attr = node.asKindOrThrow(SyntaxKind.JsxAttribute);
      const attrName = attr.getNameNode().getText();
      if (!UI_TEXT_ATTRIBUTES.has(attrName)) return;
      const initializer = attr.getInitializer();
      if (!initializer || initializer.getKind() !== SyntaxKind.StringLiteral)
        return;
      const text = initializer
        .asKindOrThrow(SyntaxKind.StringLiteral)
        .getLiteralValue();
      if (!looksLikeUiText(text) || isInsideTranslationCall(attr)) return;
      results.push({
        key: keyFor(filePath, text),
        text,
        filePath,
        componentName: enclosingComponentName(attr),
        surroundingCode: surroundingCode(attr),
      });
    }
  });

  return results;
}

export function extractFromProject(
  rootDir: string,
  sourceGlobs: string[],
): ExtractedString[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false,
  });
  for (const glob of sourceGlobs) {
    project.addSourceFilesAtPaths(`${rootDir}/${glob}`);
  }
  const results: ExtractedString[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    if (TEST_OR_STORY_FILE_PATTERN.test(sourceFile.getFilePath())) continue;
    results.push(...extractFromSourceFile(sourceFile, rootDir));
  }
  return results;
}
