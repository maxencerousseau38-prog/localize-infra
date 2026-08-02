export type FrameworkId = 'nextjs' | 'vite-react' | 'react-native';

export interface Framework {
  id: FrameworkId;
  name: string;
  // Glob patterns (relative to the project root) of source files to scan for
  // hardcoded strings. Consumed by the extractor in Task 2.
  sourceGlobs: string[];
  // Directory (relative to the project root) where locale JSON files are read/written.
  localesDir: string;
}
