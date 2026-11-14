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
