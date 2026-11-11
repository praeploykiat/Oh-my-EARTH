# Earth Trend Detective

NASA Space Apps Challenge 2026 · Challenge: **Be An Earth System Trend Detective!**

An interactive story driven by NASA Earth observation data, paired with a workbench that tests whether an Earth system variable is changing, where, by how much, and whether the change is statistically significant.

> Status: scaffold. Research question, story design, and real datasets are in progress.

## Structure

```
contracts/     JSON schemas shared by the pipeline and the web app
fixtures/      Reference trend cases both implementations must match
pipeline/      Python: fetch NASA data, compute trends, export datasets
web/           Vite + React + TypeScript app
  public/datasets/   Exported datasets read by the app
  src/core/          Stats and data loading
  src/features/      experience (interactive story), workbench (analysis tool)
  src/shared/        Chart and summary components
```

Data flows one way: `pipeline/export.py` writes `web/public/datasets/`, the web app reads it. Every dataset must match `contracts/dataset.schema.json`.

## Getting started

### Web

```bash
cd web
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Stats tests against shared fixtures |
| `npm run typecheck` | TypeScript check |
| `npm run validate:data` | Check datasets against the contract |
| `npm run build` | Production build into `web/dist` |

### Languages

The UI shows one language at a time, English by default, with a switcher in the nav. The choice is remembered per browser.

- Strings live in `web/src/core/i18n/en.ts` and `th.ts`.
- Add a key to `en.ts` first. TypeScript and `npm test` fail until `th.ts` has the same key and placeholders.
- Use `const { t } = useI18n()` and `t('key', { name: value })` in components.

### Pipeline

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt

python export.py --sample     # synthetic data, works offline
python export.py              # real data from NASA POWER
pytest
```

Add or change datasets in `SPECS` inside `pipeline/export.py`.

## Method

1. Monthly series per location from NASA POWER (MERRA-2 based).
2. Seasonal cycle removed by subtracting each calendar month's mean.
3. Mann-Kendall test for a monotonic trend (two-sided, tie-corrected, α = 0.05).
4. Sen's slope for the rate of change, reported per decade.

Both the Python and TypeScript implementations are checked against `fixtures/trend-cases.json`, which is cross-checked with `pymannkendall` (`python make_fixtures.py`).

Known limitation: the test does not yet correct for serial autocorrelation, which can overstate significance.

## Deployment

Pushing to `main` deploys `web/` to GitHub Pages through `.github/workflows/deploy.yml`.

One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

CI (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: typecheck, tests in both languages, dataset validation, and build.

## Data

| Source | Product | Use |
| --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) | MERRA-2 monthly point data | Temperature and precipitation series |

Sample datasets in `web/public/datasets/` are synthetic until replaced by `python export.py`. Each file marks this with `source.synthetic`.

## Use of AI

AI tools were used in this project as follows. Update this section as the project changes.

| Tool | Where | How |
| --- | --- | --- |
| Claude (Anthropic) | Project scaffold, stats implementations, CI, this README | Generated initial code, reviewed and tested by the team |
| Claude (Anthropic) | Ideation | Brainstorming challenge interpretation and story concepts |

## License

[MIT](LICENSE)
