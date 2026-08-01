import { describe, expect, it } from 'vitest';
import { lengthOverflow } from './length.js';

describe('lengthOverflow', () => {
  it('is false when there is no length constraint', () => {
    expect(lengthOverflow('a very long translated string indeed', null)).toBe(
      false,
    );
  });

  it('is false when the translation fits within the constraint', () => {
    expect(lengthOverflow('short', 10)).toBe(false);
  });

  it('is true when the translation exceeds the constraint', () => {
    expect(lengthOverflow('this translation is too long', 10)).toBe(true);
  });
});
