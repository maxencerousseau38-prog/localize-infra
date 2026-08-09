import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Every step of the type scale (tokens.css, `--text-*`) — the application's
 * eight plus the site's three editorial steps.
 *
 * tailwind-merge has to be told about these. Out of the box it knows Tailwind's
 * default font-size names, so a custom `text-body` looks to it like a *colour*
 * — and `cn('text-inverse', 'text-body')` silently dropped `text-inverse` as a
 * conflicting utility in the same group.
 *
 * That produced dark ink on the dark primary button and 3.29:1 on the danger
 * button, from a change that only touched font sizes. It was invisible in the
 * source, invisible in the generated CSS (both utilities existed and were
 * correct), and only showed up in the computed class list on the element.
 */
const TYPE_SCALE = [
  'micro',
  'caption',
  'small',
  'body',
  'subtitle',
  'title',
  'display',
  'display-lg',
  // Editorial steps, used by apps/site only.
  'prose',
  'headline',
  'display-xl',
  'display-2xl',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Declaring these as font-size lets twMerge keep a colour and a size on
      // the same element, and still collapse two sizes down to the last one.
      'font-size': [{ text: [...TYPE_SCALE] }],
    },
  },
});

/**
 * Merge class names with Tailwind conflict resolution.
 * `clsx` handles conditionals; `twMerge` ensures a later utility wins over an
 * earlier conflicting one, so consumers can override component defaults
 * without `!important` or specificity games.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
