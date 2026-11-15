import { describe, expect, it } from 'vitest';
import { parsePowerMonthly, requestUrl } from './power';
import { VARIABLES, variableByKey } from './variables';

describe('parsePowerMonthly', () => {
  const body = {
    properties: {
      parameter: {
        T2M: { '200102': 27.4, '200101': 26.9, '200113': 27.1, '200103': -999 },
      },
    },
  };

  it('sorts months, drops the annual value and maps missing values to null', () => {
    expect(parsePowerMonthly(body, 'T2M')).toEqual([
      { t: '2001-01', value: 26.9 },
      { t: '2001-02', value: 27.4 },
      { t: '2001-03', value: null },
    ]);
  });

  it('fails clearly when the parameter is missing', () => {
    expect(() => parsePowerMonthly(body, 'RH2M')).toThrow('RH2M');
  });
  it('uses the response fill value and discards invalid months and nonfinite values', () => {
    expect(parsePowerMonthly({ header: { fill_value: -9999 }, properties: { parameter: { T2M: {
      '200101': -9999, '200102': Infinity, '200103': 0, '200100': 1, '200114': 2,
    } } } }, 'T2M')).toEqual([
      { t: '2001-01', value: null }, { t: '2001-02', value: null }, { t: '2001-03', value: 0 },
    ]);
  });
});

describe('requestUrl', () => {
  it('builds a monthly point request', () => {
    const url = new URL(requestUrl({ parameter: 'T2M', lat: 8.6, lon: 98.2 }));
    expect(url.searchParams.get('parameters')).toBe('T2M');
    expect(url.searchParams.get('latitude')).toBe('8.6000');
    expect(url.searchParams.get('format')).toBe('JSON');
  });
});

describe('variables', () => {
  it('has unique keys and labels in both languages', () => {
    expect(new Set(VARIABLES.map((v) => v.key)).size).toBe(VARIABLES.length);
    for (const v of VARIABLES) {
      expect(v.label.en && v.label.th && v.description.en && v.description.th).toBeTruthy();
    }
    expect(variableByKey('T2M')?.unit).toBe('°C');
  });
});
