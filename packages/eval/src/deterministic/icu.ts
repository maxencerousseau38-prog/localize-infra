import { parse } from '@formatjs/icu-messageformat-parser';

const ICU_CONTROL_PATTERN = /\{[a-zA-Z0-9_]+,\s*(plural|select|selectordinal),/;

export function isIcuMessage(text: string): boolean {
  return ICU_CONTROL_PATTERN.test(text);
}

export function validateIcu(text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}
