export const en = {
  'app.title': 'Earth Trend Detective',
  'nav.experience': 'Experience',
  'nav.workbench': 'Workbench',
  'language.label': 'Language',

  'status.loading': 'Loading…',
  'chart.noData': 'No data',

  'trend.rising': 'Rising {value} {unit} per decade',
  'trend.falling': 'Falling {value} {unit} per decade',
  'trend.flat': 'No change per decade',
  'trend.pBelow': 'p < 0.001',
  'trend.pValue': 'p = {value}',
  'trend.significant': 'significant at α = {alpha}',
  'trend.notSignificant': 'not significant',
  'trend.synthetic': 'synthetic sample data',

  'experience.title': 'Experience',
  'experience.placeholder': 'Placeholder for the interactive story. Design is still in progress.',
  'experience.start': 'Start',
  'experience.play': 'Play',
  'experience.playPlaceholder': 'Game mechanics will be driven by the dataset values.',
  'experience.finish': 'Finish',
  'experience.revealTitle': 'What you just lived through',
  'experience.playAgain': 'Play again',
  'experience.investigate': 'Investigate yourself',

  'workbench.title': 'Workbench',
  'workbench.dataset': 'Dataset',
  'workbench.removeSeasonality': 'Remove seasonal cycle',
} as const;

export type MessageKey = keyof typeof en;
