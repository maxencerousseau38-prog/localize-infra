import { describe, expect, it } from 'vitest';
import { cn } from '../lib/cn';

/**
 * Guards the class-merge configuration.
 *
 * tailwind-merge groups conflicting utilities so the last one wins. It knows
 * Tailwind's built-in font-size names; it does not know ours. Until it was
 * told, `text-body` looked like a colour, so combining it with `text-inverse`
 * dropped the colour — which rendered the primary button as dark ink on a dark
 * fill, and the danger button at 3.29:1.
 *
 * What made that dangerous is where it was invisible: the source was right, and
 * both `.text-inverse{color:…}` and `.text-body{font-size:…}` existed in the
 * compiled CSS. Only the element's final class list showed the loss. These
 * tests assert on that class list.
 */
describe('cn', () => {
  it('keeps a colour and a type step on the same element', () => {
    // The regression, stated directly.
    const result = cn('bg-primary text-inverse', 'text-body');
    expect(result).toContain('text-inverse');
    expect(result).toContain('text-body');
  });

  it('still collapses two type steps to the last one', () => {
    // The whole reason to declare the group: conflicts inside it must resolve.
    expect(cn('text-body', 'text-title')).toBe('text-title');
    expect(cn('text-caption', 'text-micro')).toBe('text-micro');
  });

  it('still collapses two text colours to the last one', () => {
    expect(cn('text-primary', 'text-secondary')).toBe('text-secondary');
  });

  it('covers every step of the scale', () => {
    for (const step of [
      'micro',
      'caption',
      'small',
      'body',
      'subtitle',
      'title',
      'display',
      'display-lg',
    ]) {
      const result = cn('text-inverse', `text-${step}`);
      expect(result, `text-${step} must not evict a colour`).toContain(
        'text-inverse',
      );
      expect(result).toContain(`text-${step}`);
    }
  });

  it('lets a caller override a component default', () => {
    // The reason cn exists at all — this must keep working.
    expect(cn('rounded-md p-4', 'p-6')).toBe('rounded-md p-6');
  });
});
