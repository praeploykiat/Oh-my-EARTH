import { monthsOfYear } from './time';
import type { GameRound } from './types';

const YEARLY_AVERAGE = { en: 'Average for each month, 2001 to 2024', th: 'ค่าเฉลี่ยแต่ละเดือน 2001 ถึง 2024' };

// Mock rounds used until rounds are saved from the admin page

export const DEFAULT_ROUNDS: GameRound[] = [
  {
    id: 'chiang-mai-soil',
    place: { en: 'Chiang Mai', th: 'เชียงใหม่' },
    time: monthsOfYear(),
    timeLabel: YEARLY_AVERAGE,
    given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: [0.3, 0.4, 0.9, 2.1, 5.6, 5.2, 6.1, 7.4, 7.0, 3.9, 1.2, 0.4] },
    hidden: { label: { en: 'Soil moisture', th: 'ความชื้นในดิน' }, unit: 'kg/m²', values: [20, 18, 17, 18, 22, 26, 29, 32, 34, 33, 28, 23] },
    answer: {
      en: '**Soil follows the rain, about a month later.**\n\n- Rain peaks in August\n- Soil moisture peaks in September\n\nThe ground stays damp into November because water drains slowly.',
      th: '**ดินชื้นตามฝน แต่ช้ากว่าราว 1 เดือน**\n\n- ฝนมากที่สุดเดือนสิงหาคม\n- ดินชื้นที่สุดเดือนกันยายน\n\nดินยังชื้นต่อถึงพฤศจิกายนเพราะน้ำในดินระบายออกช้า',
    },
    source: 'Mock data',
  },
  {
    id: 'bangkok-heat',
    place: { en: 'Bangkok', th: 'กรุงเทพฯ' },
    time: monthsOfYear(),
    timeLabel: YEARLY_AVERAGE,
    given: { label: { en: 'Sunlight', th: 'แสงแดด' }, unit: 'kWh/m²/day', values: [4.9, 5.4, 5.9, 6.1, 5.5, 4.9, 4.7, 4.6, 4.5, 4.6, 4.7, 4.7] },
    hidden: { label: { en: 'Air temperature', th: 'อุณหภูมิอากาศ' }, unit: '°C', values: [27.0, 28.4, 29.6, 30.6, 30.2, 29.4, 29.0, 28.8, 28.4, 28.2, 27.8, 26.8] },
    answer: {
      en: '**April is the hottest month.**\n\nSunlight peaks in March and April before monsoon clouds arrive, and the air heats up with it.',
      th: '**เมษายนร้อนที่สุด**\n\nแดดแรงที่สุดช่วงมีนาคมถึงเมษายน ก่อนเมฆมรสุมจะมา อากาศจึงร้อนตามไปด้วย',
    },
    source: 'Mock data',
  },
  {
    id: 'songkhla-runoff',
    place: { en: 'Songkhla', th: 'สงขลา' },
    time: monthsOfYear(),
    timeLabel: YEARLY_AVERAGE,
    given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: [3.4, 1.2, 1.5, 2.6, 4.1, 3.3, 3.2, 3.0, 3.6, 7.0, 13.5, 12.0] },
    hidden: { label: { en: 'Runoff', th: 'น้ำไหลบ่า' }, unit: 'mm/day', values: [0.6, 0.1, 0.1, 0.2, 0.4, 0.3, 0.3, 0.3, 0.4, 1.2, 3.8, 3.1] },
    answer: {
      en: '**Runoff jumps when heavy rain falls on wet ground.**\n\nThe northeast monsoon brings most of it in November and December.',
      th: '**น้ำไหลบ่าพุ่งขึ้นเมื่อฝนหนักตกลงบนดินที่ชุ่มอยู่แล้ว**\n\nมรสุมตะวันออกเฉียงเหนือทำให้เกิดมากที่สุดช่วงพฤศจิกายนถึงธันวาคม',
    },
    source: 'Mock data',
  },
];
