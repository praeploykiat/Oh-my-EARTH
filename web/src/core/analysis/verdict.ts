import type { Dataset } from '../data/types';
import type { MessageKey } from '../i18n';

export interface VerdictKeys {
  direction: MessageKey;
  confidence: MessageKey;
  value: string;
}

const STRONG_P = 0.01;

export function verdictKeys(trend: Dataset['trend'], decimals = 2): VerdictKeys {
  const value = Math.abs(trend.slopePerDecade).toFixed(decimals);
  const flat = Number(value) === 0;

  const direction: MessageKey = flat ? 'verdict.flat' : trend.slopePerDecade > 0 ? 'verdict.rising' : 'verdict.falling';

  const confidence: MessageKey = !trend.significant
    ? 'verdict.notProven'
    : trend.pValue < STRONG_P
      ? 'verdict.veryUnlikelyChance'
      : 'verdict.unlikelyChance';

  return { direction, confidence, value };
}
