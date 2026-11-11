export const en = {
  'app.title': 'Earth Trend Detective',
  'nav.experience': 'Experience',
  'nav.workbench': 'Workbench',
  'nav.main': 'Main navigation',
  'language.label': 'Language',

  'status.loading': 'Loading…',

  'chart.title': 'Monthly series',
  'chart.label': 'Time series in {unit}',
  'chart.noData': 'No data',
  'chart.observed': 'Observed',
  'chart.trend': "Sen's slope",

  'stats.trend': 'Trend',
  'stats.perDecade': '{unit} per decade',
  'stats.pValue': 'p-value',
  'stats.mannKendall': 'Mann-Kendall test',
  'stats.verdict': 'Verdict',
  'stats.significant': 'Significant',
  'stats.notSignificant': 'Not significant',
  'stats.record': 'Record',
  'stats.points': '{count} data points',

  'source.label': 'Source',
  'source.synthetic': 'Synthetic sample',

  'resolution.monthly': 'Monthly',
  'resolution.annual': 'Annual',

  'landing.eyebrow': 'NASA Space Apps Challenge 2026 · Thailand',
  'landing.title': 'Is Earth really changing where you live?',
  'landing.lead':
    'Live through decades of real NASA Earth observations, then test the trend yourself with the same statistics scientists use.',
  'landing.start': 'Start',
  'landing.openWorkbench': 'Open workbench',
  'landing.howTitle': 'How it works',
  'landing.step1.title': 'Live it',
  'landing.step1.body': 'Every outcome in the story is weighted by real satellite and model data for that place and year.',
  'landing.step2.title': 'Notice it',
  'landing.step2.body': 'Play again and again. Patterns start to appear before any chart is shown.',
  'landing.step3.title': 'Prove it',
  'landing.step3.body': 'See the data behind every life, then test whether the change is statistically significant.',

  'experience.play': 'Play',
  'experience.playPlaceholder': 'Game mechanics will be driven by the dataset values.',
  'experience.finish': 'Finish',
  'experience.revealTitle': 'What you just lived through',
  'experience.playAgain': 'Play again',
  'experience.investigate': 'Investigate yourself',

  'workbench.title': 'Workbench',
  'workbench.intro': 'Pick a dataset to see how it changed and whether the change is real or just noise.',
  'workbench.dataset': 'Dataset',
  'workbench.options': 'Analysis',
  'workbench.removeSeasonality': 'Remove seasonal cycle',

  'footer.team': 'Far Side of the Moon',
  'footer.event': 'NASA Space Apps Challenge 2026 · Bangkok',
  'footer.links': 'Project links',
  'footer.challenge': 'Challenge',
  'footer.data': 'Data: NASA POWER',
  'footer.source': 'Source code',
  'footer.disclaimer':
    'Built for the NASA Space Apps Challenge using NASA open data. Not affiliated with or endorsed by NASA.',
} as const;

export type MessageKey = keyof typeof en;
