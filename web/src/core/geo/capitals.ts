import locations from './capitals.json';

export interface Capital {
  code: string;
  iso3: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
}

export const CAPITALS: Capital[] = locations;

export function capitalByCode(code: string): Capital | undefined {
  return CAPITALS.find((capital) => capital.code === code);
}
