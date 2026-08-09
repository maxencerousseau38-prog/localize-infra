export { cn } from './lib/cn';
export { fuzzyMatch, highlightRuns, type FuzzyMatch } from './lib/fuzzy';
export {
  localeDir,
  localeDisplayName,
  localeFontClass,
  localeTextProps,
} from './lib/locale';

/* ── Primitives ──────────────────────────────────────────────── */
export {
  Badge,
  CountBadge,
  type BadgeProps,
  type Tone,
} from './primitives/badge';
export { Button, buttonVariants, type ButtonProps } from './primitives/button';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
} from './primitives/card';
export {
  CheckboxField,
  RadioGroupRoot,
  RadioOption,
  SwitchField,
} from './primitives/choice';
export { CopyCommand, type CopyCommandProps } from './primitives/copy-command';
export {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  SheetContent,
} from './primitives/dialog';
export {
  AvatarRoot,
  ProgressBar,
  SeparatorLine,
  Skeleton,
  SkeletonTableRows,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from './primitives/feedback';
export { Field, FormColumn, useFieldControl } from './primitives/field';
export { Input, Textarea } from './primitives/input';
export {
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRoot,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './primitives/menu';
export {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from './primitives/select';
export { StateRule, type StateRuleProps } from './primitives/state-rule';
export {
  SortableTH,
  TBody,
  Table,
  TableEmpty,
  TD,
  TH,
  THead,
  TR,
} from './primitives/table';

/* ── Patterns ────────────────────────────────────────────────── */
export {
  CommandPalette,
  useCommandPaletteHotkey,
  type CommandItem,
} from './patterns/command-palette';
export { LocaleChip } from './patterns/locale-chip';
export { EmptyState, ErrorState, NotBuiltYet } from './patterns/states';
export { StringCard, type StringCardProps } from './patterns/string-card';

/* ── Theme ───────────────────────────────────────────────────── */
export {
  THEME_SCRIPT,
  applyTheme,
  isTheme,
  readTheme,
  setTheme,
  subscribeToTheme,
  type Theme,
} from './theme/theme';
export { ThemeScript } from './theme/theme-script';
export { ThemeToggle } from './theme/theme-toggle';
