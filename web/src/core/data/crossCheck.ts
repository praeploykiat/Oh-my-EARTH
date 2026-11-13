import { END_YEAR, START_YEAR } from './range';
import { giovanniLink, HYDROLOGY_HOME, REMOTE_DATASETS } from './remote';
import type { Dataset } from './types';

const POWER_VIEWER = 'https://power.larc.nasa.gov/data-access-viewer/';

export function crossCheckUrl(dataset: Dataset): string | null {
  if (dataset.source.synthetic) return null;

  const remote = REMOTE_DATASETS[dataset.variable.key];
  if (!remote) return POWER_VIEWER;
  if (remote.service === 'datarods') return HYDROLOGY_HOME;
  return giovanniLink(remote.id, dataset.region.lat, dataset.region.lon, START_YEAR, END_YEAR);
}
