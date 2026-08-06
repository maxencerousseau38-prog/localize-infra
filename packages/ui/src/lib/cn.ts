import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution.
 * `clsx` handles conditionals; `twMerge` ensures a later utility wins over an
 * earlier conflicting one, so consumers can override component defaults
 * without `!important` or specificity games.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
