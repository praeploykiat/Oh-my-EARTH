import { describe, expect, it } from 'vitest';
import { en } from './en';
import { th } from './th';
import { interpolate } from './I18nProvider';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('has a Thai string for every English key', () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(th[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('interpolate', () => {
  it('fills known variables and keeps unknown ones', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
});
