export interface GameRound {
  id: string;
  place: { en: string; th: string };
  given: { variable: string; unit: string; values: number[] };
  hidden: { variable: string; unit: string; values: number[]; hint: number };
  why: { en: string; th: string };
}

// Mock rounds: replace values with real monthly climatology once the correlated pairs are chosen
// hint is the month index shown to the player as a free point

export const ROUNDS: GameRound[] = [
  {
    id: 'chiang-mai-soil',
    place: { en: 'Chiang Mai', th: 'เชียงใหม่' },
    given: { variable: 'PRECTOTCORR', unit: 'mm/day', values: [0.3, 0.4, 0.9, 2.1, 5.6, 5.2, 6.1, 7.4, 7.0, 3.9, 1.2, 0.4] },
    hidden: { variable: 'SOIL_MOISTURE', unit: 'kg/m²', values: [20, 18, 17, 18, 22, 26, 29, 32, 34, 33, 28, 23], hint: 0 },
    why: {
      en: 'Soil fills up as the rains arrive and peaks after the wettest months. It stays damp into November because water drains slowly.',
      th: 'ดินค่อยๆ ชุ่มขึ้นเมื่อฝนมา และชื้นที่สุดหลังเดือนที่ฝนตกหนัก ยังชื้นต่อถึงพฤศจิกายนเพราะน้ำในดินระบายออกช้า',
    },
  },
  {
    id: 'bangkok-heat',
    place: { en: 'Bangkok', th: 'กรุงเทพฯ' },
    given: { variable: 'ALLSKY_SFC_SW_DWN', unit: 'kWh/m²/day', values: [4.9, 5.4, 5.9, 6.1, 5.5, 4.9, 4.7, 4.6, 4.5, 4.6, 4.7, 4.7] },
    hidden: { variable: 'T2M', unit: '°C', values: [27.0, 28.4, 29.6, 30.6, 30.2, 29.4, 29.0, 28.8, 28.4, 28.2, 27.8, 26.8], hint: 0 },
    why: {
      en: 'Sunlight peaks in March and April before monsoon clouds arrive, and the air heats up with it. April is the hottest month.',
      th: 'แดดแรงที่สุดช่วงมีนาคมถึงเมษายน ก่อนเมฆมรสุมจะมา อากาศจึงร้อนตามไปด้วย เมษายนเป็นเดือนที่ร้อนที่สุด',
    },
  },
  {
    id: 'songkhla-runoff',
    place: { en: 'Songkhla', th: 'สงขลา' },
    given: { variable: 'PRECTOTCORR', unit: 'mm/day', values: [3.4, 1.2, 1.5, 2.6, 4.1, 3.3, 3.2, 3.0, 3.6, 7.0, 13.5, 12.0] },
    hidden: { variable: 'RUNOFF', unit: 'mm/day', values: [0.6, 0.1, 0.1, 0.2, 0.4, 0.3, 0.3, 0.3, 0.4, 1.2, 3.8, 3.1], hint: 0 },
    why: {
      en: 'Runoff jumps when heavy rain falls on already wet ground. The northeast monsoon brings most of it in November and December.',
      th: 'น้ำไหลบ่าพุ่งขึ้นเมื่อฝนหนักตกลงบนดินที่ชุ่มอยู่แล้ว มรสุมตะวันออกเฉียงเหนือทำให้เกิดมากที่สุดช่วงพฤศจิกายนถึงธันวาคม',
    },
  },
];
