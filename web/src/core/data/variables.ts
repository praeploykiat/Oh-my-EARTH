import { GIOVANNI_HOME } from './remote';
import { POWER_HOME } from './power';

export type VariableSource = 'power' | 'giovanni';

export interface Provider {
  provider: string;
  product: string;
  url: string;
}

export type EarthLayer = 'atmosphere' | 'ground' | 'surface';

export const EARTH_LAYERS: EarthLayer[] = ['atmosphere', 'ground', 'surface'];

export const SATELLITES = ['Terra', 'Aqua', 'GPM'] as const;

export type Satellite = (typeof SATELLITES)[number];

export interface VariableDefinition {
  key: string;
  layer: EarthLayer;
  satellites: Satellite[];
  unit: string;
  source: VariableSource;
  provider: Provider;
  label: { en: string; th: string };
  description: { en: string; th: string };
}

const POWER: Provider = { provider: 'NASA POWER', product: 'MERRA-2 monthly point data', url: POWER_HOME };

export const VARIABLES: VariableDefinition[] = [
  {
    key: 'T2M',
    layer: 'ground',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: '°C',
    label: { en: 'Air temperature', th: 'อุณหภูมิอากาศ' },
    description: {
      en: 'Average air temperature 2 m above the ground.',
      th: 'อุณหภูมิอากาศเฉลี่ยที่ความสูง 2 เมตรจากพื้น',
    },
  },
  {
    key: 'T2M_MAX',
    layer: 'ground',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: '°C',
    label: { en: 'Daily high', th: 'อุณหภูมิสูงสุด' },
    description: {
      en: 'Average of the hottest temperature reached each day.',
      th: 'ค่าเฉลี่ยของอุณหภูมิสูงสุดในแต่ละวัน',
    },
  },
  {
    key: 'T2M_MIN',
    layer: 'ground',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: '°C',
    label: { en: 'Daily low', th: 'อุณหภูมิต่ำสุด' },
    description: {
      en: 'Average of the coolest temperature reached each day, usually at night.',
      th: 'ค่าเฉลี่ยของอุณหภูมิต่ำสุดในแต่ละวัน มักเป็นช่วงกลางคืน',
    },
  },
  {
    key: 'PRECTOTCORR',
    layer: 'atmosphere',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: 'mm/day',
    label: { en: 'Rainfall', th: 'ปริมาณฝน' },
    description: {
      en: 'Average rain per day, corrected against rain gauges.',
      th: 'ปริมาณฝนเฉลี่ยต่อวัน ปรับเทียบกับเครื่องวัดฝนภาคพื้น',
    },
  },
  {
    key: 'RH2M',
    layer: 'ground',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: '%',
    label: { en: 'Humidity', th: 'ความชื้นสัมพัทธ์' },
    description: {
      en: 'How close the air is to being saturated with water vapor.',
      th: 'อากาศมีไอน้ำใกล้จุดอิ่มตัวแค่ไหน',
    },
  },
  {
    key: 'WS2M',
    layer: 'ground',
    satellites: [],
    source: 'power',
    provider: POWER,
    unit: 'm/s',
    label: { en: 'Wind speed', th: 'ความเร็วลม' },
    description: {
      en: 'Average wind speed 2 m above the ground.',
      th: 'ความเร็วลมเฉลี่ยที่ความสูง 2 เมตรจากพื้น',
    },
  },
  {
    key: 'ALLSKY_SFC_SW_DWN',
    layer: 'atmosphere',
    satellites: ['Terra', 'Aqua'],
    source: 'power',
    provider: POWER,
    unit: 'kWh/m²/day',
    label: { en: 'Sunlight', th: 'แสงแดด' },
    description: {
      en: 'Solar energy reaching the ground, including the effect of clouds.',
      th: 'พลังงานแสงอาทิตย์ที่ส่องถึงพื้น รวมผลของเมฆแล้ว',
    },
  },
  {
    key: 'IMERG_RAIN',
    layer: 'atmosphere',
    satellites: ['GPM'],
    source: 'giovanni',
    provider: { provider: 'NASA Giovanni', product: 'GPM IMERG monthly precipitation (V07)', url: GIOVANNI_HOME },
    unit: 'mm/day',
    label: { en: 'Satellite rainfall', th: 'ฝนจากดาวเทียม' },
    description: {
      en: 'Rain measured by the GPM satellite constellation, not a weather model.',
      th: 'ปริมาณฝนที่วัดจากกลุ่มดาวเทียม GPM ไม่ใช่จากแบบจำลองสภาพอากาศ',
    },
  },
  {
    key: 'AOD',
    layer: 'atmosphere',
    satellites: ['Terra', 'Aqua'],
    source: 'giovanni',
    provider: { provider: 'NASA Giovanni', product: 'MERRA-2 aerosol optical depth, 550 nm (M2T1NXAER hourly, averaged monthly)', url: GIOVANNI_HOME },
    unit: 'AOD',
    label: { en: 'Haze', th: 'หมอกควัน' },
    description: {
      en: 'Aerosol optical depth: how much smoke, dust and haze block sunlight. Higher means hazier air.',
      th: 'ความลึกเชิงแสงของฝุ่นละออง: ควัน ฝุ่น และหมอกบังแสงแดดมากแค่ไหน ยิ่งสูงอากาศยิ่งขมุกขมัว',
    },
  },
  {
    key: 'SOIL_MOISTURE',
    layer: 'surface',
    satellites: [],
    source: 'giovanni',
    provider: { provider: 'NASA Giovanni', product: 'GLDAS Noah 0.25° monthly, soil moisture 0 to 10 cm', url: GIOVANNI_HOME },
    unit: 'kg/m²',
    label: { en: 'Soil moisture', th: 'ความชื้นในดิน' },
    description: {
      en: 'Water held in the top 10 cm of soil, where most crops take root.',
      th: 'ปริมาณน้ำในดินชั้นบน 10 ซม. ซึ่งเป็นชั้นที่รากพืชส่วนใหญ่อยู่',
    },
  },
  {
    key: 'RUNOFF',
    layer: 'surface',
    satellites: [],
    source: 'giovanni',
    provider: { provider: 'NASA Giovanni', product: 'GLDAS Noah 0.25° monthly, surface runoff', url: GIOVANNI_HOME },
    unit: 'mm/day',
    label: { en: 'Runoff', th: 'น้ำไหลบ่า' },
    description: {
      en: 'Rain that flows off the land surface instead of soaking in. Rising runoff can mean more flash floods.',
      th: 'น้ำฝนที่ไหลบ่าบนผิวดินแทนที่จะซึมลงดิน ถ้าเพิ่มขึ้นอาจหมายถึงน้ำท่วมฉับพลันบ่อยขึ้น',
    },
  },
  {
    key: 'EVAPOTRANSPIRATION',
    layer: 'surface',
    satellites: [],
    source: 'giovanni',
    provider: { provider: 'NASA Giovanni', product: 'GLDAS Noah 0.25° monthly, evapotranspiration', url: GIOVANNI_HOME },
    unit: 'mm/day',
    label: { en: 'Evaporation', th: 'การคายระเหยน้ำ' },
    description: {
      en: 'Water returned to the air from soil, rivers and plants. Higher values dry the land faster.',
      th: 'น้ำที่ระเหยกลับสู่อากาศจากดิน แหล่งน้ำ และพืช ยิ่งสูงดินยิ่งแห้งเร็ว',
    },
  },
];

const BY_KEY = new Map(VARIABLES.map((v) => [v.key, v]));

export function variableByKey(key: string): VariableDefinition | undefined {
  return BY_KEY.get(key);
}
