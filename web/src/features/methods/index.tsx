import { VARIABLES } from '../../core/data';
import { useI18n, type MessageKey } from '../../core/i18n';
import { RESOURCE_GROUPS } from './resources';

type Step = { title: MessageKey; body: MessageKey };

const THAILAND_STEPS: Step[] = [
  { title: 'methods.step1.title', body: 'methods.step1.body' },
  { title: 'methods.step2.title', body: 'methods.step2.body' },
  { title: 'methods.step3.title', body: 'methods.step3.body' },
];

const GLOBAL_STEPS: Step[] = [
  { title: 'methods.global.step1.title', body: 'methods.global.step1.body' },
  { title: 'methods.global.step2.title', body: 'methods.global.step2.body' },
  { title: 'methods.global.step3.title', body: 'methods.global.step3.body' },
];

type Text = { en: string; th: string };

// Saved in advance from NASA, read from web/public/explorer-cache, co2-cache and data/hotspots.json
const GLOBAL_DATA: { variable: Text; product: string; url: string; coverage: Text }[] = [
  {
    variable: { en: 'Air temperature, rainfall, humidity, sunlight', th: 'อุณหภูมิอากาศ ฝน ความชื้น แสงแดด' },
    product: 'NASA POWER (MERRA-2, CERES)',
    url: 'https://power.larc.nasa.gov/',
    coverage: {
      en: '195 capitals, 632 hotspot points, and Phuket on the home page. 2001 to 2024',
      th: '195 เมืองหลวง 632 จุดในแผนที่จุดร้อน และภูเก็ตในหน้าแรก ปี 2001 ถึง 2024',
    },
  },
  {
    variable: { en: 'Soil moisture, evapotranspiration', th: 'ความชื้นในดิน การคายระเหยน้ำ' },
    product: 'GLDAS Noah 2.1, through NASA Giovanni',
    url: 'https://giovanni.gsfc.nasa.gov/',
    coverage: { en: '148 of 195 capitals (no land-model data at some coasts and islands). 2001 to 2024', th: '148 จาก 195 เมืองหลวง (บางเมืองชายฝั่งและเกาะไม่มีข้อมูลแบบจำลองพื้นดิน) ปี 2001 ถึง 2024' },
  },
  {
    variable: { en: 'Haze (aerosol optical depth)', th: 'หมอกควัน (ความหนาแน่นของละอองลอย)' },
    product: 'MERRA-2 M2T1NXAER, through NASA Giovanni',
    url: 'https://giovanni.gsfc.nasa.gov/',
    coverage: { en: '195 capitals. 2001 to 2024', th: '195 เมืองหลวง ปี 2001 ถึง 2024' },
  },
  {
    variable: { en: 'Carbon dioxide (column average)', th: 'คาร์บอนไดออกไซด์ (ค่าเฉลี่ยทั้งชั้นบรรยากาศ)' },
    product: 'OCO-2 GEOS Level 3, through NASA Giovanni',
    url: 'https://giovanni.gsfc.nasa.gov/',
    coverage: { en: '195 capitals. 2015 to 2021', th: '195 เมืองหลวง ปี 2015 ถึง 2021' },
  },
];

function Steps({ steps }: { steps: Step[] }) {
  const { t } = useI18n();
  return (
    <div className="steps">
      {steps.map((step, i) => (
        <article key={step.title} className="card step">
          <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
          <h3>{t(step.title)}</h3>
          <p>{t(step.body)}</p>
        </article>
      ))}
    </div>
  );
}

export function Methods() {
  const { language, t } = useI18n();

  return (
    <section className="section methods">
      <header className="workbench-intro">
        <span className="eyebrow">{t('methods.title')}</span>
        <h1>{t('methods.heading')}</h1>
        <p>{t('methods.intro')}</p>
      </header>

      <h2 className="methods-heading">{t('methods.thailand.title')}</h2>
      <Steps steps={THAILAND_STEPS} />

      <h2 className="methods-heading">{t('methods.global.title')}</h2>
      <Steps steps={GLOBAL_STEPS} />
      <p className="methods-note">{t('methods.co2')}</p>

      <h2 className="methods-heading">{t('methods.game.title')}</h2>
      <p className="methods-note">{t('methods.game.body')}</p>

      <aside className="notice methods-limits">
        <strong>{t('methods.limits.title')}</strong> {t('methods.limits.body')}
      </aside>

      <h2 className="methods-heading">{t('methods.data.title')}</h2>
      <h3 className="methods-subheading">{t('methods.data.global')}</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('methods.data.variable')}</th>
              <th>{t('methods.data.product')}</th>
              <th>{t('methods.data.coverage')}</th>
            </tr>
          </thead>
          <tbody>
            {GLOBAL_DATA.map((row) => (
              <tr key={row.product}>
                <td>
                  <strong>{row.variable[language]}</strong>
                </td>
                <td>
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.product}
                  </a>
                </td>
                <td>{row.coverage[language]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="methods-subheading">{t('methods.data.thailand')}</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('methods.data.variable')}</th>
              <th>{t('methods.data.product')}</th>
              <th>{t('methods.data.access')}</th>
            </tr>
          </thead>
          <tbody>
            {VARIABLES.map((variable) => (
              <tr key={variable.key}>
                <td>
                  <strong>{variable.label[language]}</strong>
                  <span>{variable.unit}</span>
                </td>
                <td>
                  <a href={variable.provider.url} target="_blank" rel="noreferrer">
                    {variable.provider.provider}
                  </a>
                  <span>{variable.provider.product}</span>
                </td>
                <td>{t(variable.source === 'power' ? 'methods.access.direct' : 'methods.access.proxy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="methods-heading">{t('methods.reading.title')}</h2>
      <div className="resource-groups">
        {RESOURCE_GROUPS.map((group) => (
          <div key={group.title.en} className="resource-group">
            <span className="control-label">{group.title[language]}</span>
            <ul>
              {group.items.map((item) => (
                <li key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title} ↗
                  </a>
                  <p>{item.note[language]}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
