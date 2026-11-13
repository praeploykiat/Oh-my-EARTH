import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nearestProvince, PROVINCES, provinceAt, provinceByCode, provinceCentroid, type ProvinceCollection } from '.';

const boundaries: ProvinceCollection = JSON.parse(
  readFileSync(join(__dirname, '../../../public/geo/thailand-provinces.json'), 'utf-8'),
);

describe('province table', () => {
  it('has 77 unique provinces', () => {
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(77);
  });

  it('matches every boundary code', () => {
    const boundaryCodes = boundaries.features.map((f) => f.properties.code).sort();
    expect(boundaryCodes).toEqual(PROVINCES.map((p) => p.code).sort());
  });
});

describe('point lookup', () => {
  it.each([
    ['TH-10', 13.75, 100.5],
    ['TH-50', 18.79, 98.98],
    ['TH-90', 7.2, 100.6],
  ])('finds %s', (code, lat, lon) => {
    expect(provinceAt(boundaries, { lat, lon })?.properties.code).toBe(code);
  });

  it('returns nothing outside Thailand', () => {
    expect(provinceAt(boundaries, { lat: 1.35, lon: 103.8 })).toBeUndefined();
  });

  it('snaps a point just offshore to the nearest province', () => {
    expect(provinceAt(boundaries, { lat: 8.6, lon: 98.2 })).toBeUndefined();
    expect(nearestProvince(boundaries, { lat: 8.6, lon: 98.2 })?.properties.code).toBe('TH-82');
  });

  it('places each centroid near its province', () => {
    const chiangMai = boundaries.features.find((f) => f.properties.code === 'TH-50')!;
    const { lat, lon } = provinceCentroid(chiangMai);
    expect(lat).toBeGreaterThan(17.5);
    expect(lat).toBeLessThan(20);
    expect(lon).toBeGreaterThan(98);
    expect(lon).toBeLessThan(99.6);
    expect(provinceByCode('TH-50')?.th).toBe('เชียงใหม่');
  });
});
