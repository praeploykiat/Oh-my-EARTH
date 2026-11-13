import { VARIABLES } from '../../core/data';
import { useI18n, type MessageKey } from '../../core/i18n';
import { RESOURCE_GROUPS } from './resources';

const STEPS: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: 'methods.step1.title', body: 'methods.step1.body' },
  { title: 'methods.step2.title', body: 'methods.step2.body' },
  { title: 'methods.step3.title', body: 'methods.step3.body' },
];

export function Methods() {
  const { language, t } = useI18n();

  return (
    <section className="section methods">
      <header className="workbench-intro">
        <span className="eyebrow">{t('methods.title')}</span>
        <h1>{t('methods.heading')}</h1>
        <p>{t('methods.intro')}</p>
      </header>

      <div className="steps">
        {STEPS.map((step, i) => (
          <article key={step.title} className="card step">
            <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
            <h3>{t(step.title)}</h3>
            <p>{t(step.body)}</p>
          </article>
        ))}
      </div>

      <aside className="notice methods-limits">
        <strong>{t('methods.limits.title')}</strong> {t('methods.limits.body')}
      </aside>

      <h2 className="methods-heading">{t('methods.data.title')}</h2>
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
