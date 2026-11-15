export interface Localized {
  en: string;
  th: string;
}

export interface RoundSeries {
  label: Localized;
  unit: string;
  values: (number | null)[];
}

export interface GameRound {
  id: string;
  place: Localized;
  time: string[];
  timeLabel: Localized;
  given: RoundSeries;
  hidden: RoundSeries;
  answer: Localized;
  source: string;
}

// Continue the line: players see the record up to showUntil and draw the rest

export interface ExtendRound {
  kind: 'extend';
  id: string;
  place: Localized;
  time: string[];
  timeLabel: Localized;
  series: RoundSeries;
  showUntil: string;
  answer: Localized;
  source: string;
}

export type AnyRound = GameRound | ExtendRound;
export type RoundKind = 'pair' | 'extend';

export const isExtend = (r: AnyRound): r is ExtendRound => (r as ExtendRound).kind === 'extend';
export const kindOf = (r: AnyRound): RoundKind => (isExtend(r) ? 'extend' : 'pair');
