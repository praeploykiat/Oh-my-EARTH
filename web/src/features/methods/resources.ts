export interface Resource {
  title: string;
  url: string;
  note: { en: string; th: string };
}

export interface ResourceGroup {
  title: { en: string; th: string };
  items: Resource[];
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    title: { en: 'NASA data tools', th: 'เครื่องมือข้อมูลของ NASA' },
    items: [
      {
        title: 'NASA POWER',
        url: 'https://power.larc.nasa.gov/',
        note: { en: 'Temperature, rain, humidity, wind and sunlight from MERRA-2.', th: 'อุณหภูมิ ฝน ความชื้น ลม และแสงแดด จาก MERRA-2' },
      },
      {
        title: 'Giovanni',
        url: 'https://giovanni.gsfc.nasa.gov/',
        note: { en: 'Haze, satellite rainfall and soil moisture time series.', th: 'อนุกรมเวลาหมอกควัน ฝนจากดาวเทียม และความชื้นในดิน' },
      },
      {
        title: 'Hydrology Time Series',
        url: 'https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series',
        note: { en: 'Runoff and evaporation from the GLDAS land model.', th: 'น้ำไหลบ่าและการคายระเหยน้ำจากแบบจำลอง GLDAS' },
      },
      {
        title: 'AppEEARS',
        url: 'https://appeears.earthdatacloud.nasa.gov/',
        note: { en: 'Satellite land products such as vegetation and land surface temperature.', th: 'ข้อมูลผิวโลกจากดาวเทียม เช่น พืชพรรณและอุณหภูมิผิวดิน' },
      },
      {
        title: 'Climate Data Online (NOAA)',
        url: 'https://www.ncei.noaa.gov/cdo-web/',
        note: { en: 'Weather station records for checking model data against the ground.', th: 'ข้อมูลสถานีตรวจอากาศ ใช้เทียบข้อมูลแบบจำลองกับภาคพื้น' },
      },
    ],
  },
  {
    title: { en: 'Trend testing', th: 'การทดสอบแนวโน้ม' },
    items: [
      {
        title: 'Time-Series Analysis of SeaWiFS Chlorophyll (NASA)',
        url: 'https://ntrs.nasa.gov/api/citations/20090042747/downloads/20090042747.pdf',
        note: { en: 'NASA study that builds time series and tests their significance.', th: 'งานวิจัยของ NASA ที่สร้างอนุกรมเวลาและทดสอบนัยสำคัญ' },
      },
      {
        title: 'Statistical test methods to detect trends',
        url: 'https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b',
        note: { en: "Mann-Kendall, Sen's slope and related tests.", th: "Mann-Kendall, Sen's slope และการทดสอบที่เกี่ยวข้อง" },
      },
      {
        title: 'A Comprehensive Guide to Statistical Significance',
        url: 'https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance',
        note: { en: 'What a p-value means and what it does not.', th: 'ค่า p หมายถึงอะไร และไม่ได้หมายถึงอะไร' },
      },
    ],
  },
  {
    title: { en: 'Map data', th: 'ข้อมูลแผนที่' },
    items: [
      {
        title: 'geoBoundaries',
        url: 'https://www.geoboundaries.org/',
        note: { en: "Thailand's 77 province boundaries (CC BY 4.0).", th: 'ขอบเขต 77 จังหวัดของไทย (CC BY 4.0)' },
      },
      {
        title: 'Natural Earth',
        url: 'https://www.naturalearthdata.com/',
        note: { en: 'Outlines of neighbouring countries (public domain).', th: 'ขอบเขตประเทศเพื่อนบ้าน (สาธารณสมบัติ)' },
      },
    ],
  },
  {
    title: { en: 'Partner agencies', th: 'หน่วยงานพันธมิตร' },
    items: [
      {
        title: 'KNMI Climate Explorer',
        url: 'https://climexp.knmi.nl/',
        note: { en: 'Independent tool to cross-check climate trends.', th: 'เครื่องมืออิสระสำหรับตรวจสอบแนวโน้มภูมิอากาศเทียบกัน' },
      },
      {
        title: 'SWOT mission (CSA)',
        url: 'https://www.asc-csa.gc.ca/eng/satellites/swot/',
        note: {
          en: 'Water levels of lakes and reservoirs since 2023, too short for a trend test yet.',
          th: 'ระดับน้ำในทะเลสาบและเขื่อนตั้งแต่ปี 2023 ยังสั้นเกินกว่าจะทดสอบแนวโน้มได้',
        },
      },
      {
        title: 'Monitoring ecosystems from space (CSA)',
        url: 'https://www.asc-csa.gc.ca/eng/satellites/everyday-lives/monitoring-and-protecting-our-ecosystems-from-space.asp',
        note: { en: 'How satellite data supports land and resource monitoring.', th: 'ดาวเทียมช่วยติดตามการใช้ที่ดินและทรัพยากรได้อย่างไร' },
      },
    ],
  },
];
