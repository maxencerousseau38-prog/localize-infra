/**
 * `cn` for shadcn components, re-exported from the design system.
 *
 * shadcn's generated components import `cn` from `@/lib/utils` by convention.
 * Pointing that at the shared implementation rather than shadcn's default is
 * not cosmetic: ours extends tailwind-merge with this product's type scale, so
 * `text-body` and `text-display` are understood as font sizes rather than
 * mistaken for colours. The stock version silently evicted `text-inverse` from
 * class lists here once already, rendering dark text on a dark button.
 */
export { cn } from '@localize-infra/ui';
