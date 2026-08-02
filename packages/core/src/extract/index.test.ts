import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractFromProject } from './index.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'core-extract-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeSource(relPath: string, content: string): void {
  writeFileSync(join(dir, relPath), content);
}

describe('extractFromProject', () => {
  it('extracts JSX text content as a hardcoded string', () => {
    writeSource(
      'src/Greeting.tsx',
      'export function Greeting() {\n  return <p>Welcome back</p>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === 'Welcome back')).toBe(true);
  });

  it('extracts string literals from a whitelisted UI-text JSX attribute', () => {
    writeSource(
      'src/Search.tsx',
      `export function Search() {\n  return <input placeholder="Search products" />\n}\n`,
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === 'Search products')).toBe(true);
  });

  it('does not extract a string literal from a non-whitelisted attribute like className', () => {
    writeSource(
      'src/Box.tsx',
      `export function Box() {\n  return <div className="flex items-center" />\n}\n`,
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === 'flex items-center')).toBe(false);
  });

  it('skips JSX text already passed through a translation call', () => {
    writeSource(
      'src/Already.tsx',
      `export function Already({ t }: { t: (k: string) => string }) {\n  return <p>{t('already.translated')}</p>\n}\n`,
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text.includes('already.translated'))).toBe(
      false,
    );
  });

  it('skips whitespace-only and identifier-like JSX text (no false positives on class-name-shaped strings)', () => {
    writeSource(
      'src/Icon.tsx',
      `export function Icon() {\n  return <span className="icon-arrow-right" />\n}\n`,
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results).toHaveLength(0);
  });

  it('records the file path and surrounding code for each extracted string', () => {
    writeSource(
      'src/Header.tsx',
      'export function Header() {\n  return <h1>Dashboard</h1>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    const match = results.find((r) => r.text === 'Dashboard');
    expect(match?.filePath).toBe('src/Header.tsx');
    expect(match?.surroundingCode).toContain('Dashboard');
  });

  it('skips test/spec/story files, only extracting from real component files', () => {
    writeSource(
      'src/Widget.tsx',
      'export function Widget() {\n  return <p>Real widget text</p>\n}\n',
    );
    writeSource(
      'src/Widget.test.tsx',
      'export function WidgetFixture() {\n  return <p>Fixture-only test text</p>\n}\n',
    );
    writeSource(
      'src/Widget.spec.tsx',
      'export function WidgetSpecFixture() {\n  return <p>Spec-only fixture text</p>\n}\n',
    );
    writeSource(
      'src/Widget.stories.tsx',
      'export function WidgetStory() {\n  return <p>Story-only fixture text</p>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === 'Real widget text')).toBe(true);
    expect(results.some((r) => r.text === 'Fixture-only test text')).toBe(
      false,
    );
    expect(results.some((r) => r.text === 'Spec-only fixture text')).toBe(
      false,
    );
    expect(results.some((r) => r.text === 'Story-only fixture text')).toBe(
      false,
    );
  });

  it('does not extract purely numeric JSX text (e.g. a table cell value)', () => {
    writeSource(
      'src/Table.tsx',
      'export function Table() {\n  return <td>42</td>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === '42')).toBe(false);
  });

  it('does not extract a bare HTML entity like &nbsp;', () => {
    writeSource(
      'src/Spacer.tsx',
      'export function Spacer() {\n  return <p>&nbsp;</p>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === '&nbsp;')).toBe(false);
  });

  it('still extracts real prose that happens to contain a number', () => {
    writeSource(
      'src/Notifications.tsx',
      'export function Notifications() {\n  return <p>You have 3 new messages</p>\n}\n',
    );
    const results = extractFromProject(dir, ['src/**/*.{ts,tsx}']);
    expect(results.some((r) => r.text === 'You have 3 new messages')).toBe(
      true,
    );
  });
});
