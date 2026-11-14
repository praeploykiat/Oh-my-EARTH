const MONTH_OF_YEAR = /^(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;
const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type TimeKind = 'month-of-year' | 'year' | 'month' | 'other';

export function timeKind(time: string[]): TimeKind {
  if (time.every((t) => MONTH_OF_YEAR.test(t))) return 'month-of-year';
  if (time.every((t) => YEAR.test(t))) return 'year';
  if (time.every((t) => YEAR_MONTH.test(t))) return 'month';
  return 'other';
}

export function formatTime(t: string, language: string, style: 'short' | 'long' = 'short'): string {
  const locale = language === 'th' ? 'th-TH' : 'en-GB';
  const month = MONTH_OF_YEAR.exec(t);
  if (month) return new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2001, Number(t) - 1, 1));
  const yearMonth = YEAR_MONTH.exec(t);
  if (yearMonth) {
    const date = new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: style, year: 'numeric', calendar: 'gregory' }).format(date);
  }
  return t;
}

export function monthsOfYear(): string[] {
  return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
}

export function yearsBetween(from: number, to: number): string[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => String(from + i));
}

export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const count = (ty - fy) * 12 + (tm - fm) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const m = fm - 1 + i;
    return `${fy + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  });
}
