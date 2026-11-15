# Dependency and page regression audit

Checked November 15, 2026 (Asia/Bangkok), before further feature work.

## Reported error and reproduction

The workbench requested a URL such as:

```
/api/giovanni?variable=AOD&lat=13.7500&lon=100.2000
```

Plain Vite resolved this as `api/giovanni.ts` plus the query, instead of executing
the exported HTTP handler. Its esbuild transform inferred `2000` as the loader
from the decimal longitude at the end of the module ID. Calling Vite's
`transformRequest` with that URL reproduced `Invalid loader value: "2000"` exactly.
This path was missed by the earlier build/unit checks and global explorer preview.

The original dev configuration had no API handler adapter, and the README required
`vercel dev` for API-backed features. No frontend package version or lockfile
change was necessary to reproduce or fix this error.

## Fix

`web/scripts/local-api.ts` is a development-only Vite plugin. It intercepts `/api/`
before source transformation and runs the existing Request/Response handlers for:

- `/api/giovanni`
- `/api/flood`
- `/api/questions` (including its existing non-GET methods)

Only explicit routes can load modules. Query parameters remain on the HTTP request,
not the module ID passed to `ssrLoadModule`. The adapter preserves request bodies,
response status and headers, returns JSON for unknown routes and unsupported
methods, and does not send exception details to the browser. Unknown/source-file
API paths do not fall through into Vite transformations. The HMR overlay remains
enabled for genuine frontend development errors. Production API files are unchanged.

Server-only credentials are loaded with Vite's env-file precedence, without a
`VITE_` prefix and without adding them to client definitions. Existing shell values
take precedence. Restart the dev process after modifying local credential files.

## Dependency review

| Area | Finding |
| --- | --- |
| Frontend dependencies | No package-version or `web/package-lock.json` changes from the statistical milestone. `npm ls --depth=0` reports the declared packages without missing dependencies. |
| Vite/esbuild | Existing Vite 5.4.11. The failure is in dev request routing; no package upgrade or loader override is used as a workaround. |
| Legacy Python requirements | `pipeline/requirements.txt` is unchanged. |
| New numerical reference requirements | NumPy/SciPy are used for offline validation, not by the browser or the Vercel API handlers. They are installed in the isolated project virtual environment. |
| Pytest | The new reference requirements now pin `pytest==8.3.4`, matching the existing pipeline, rather than allowing CI to upgrade its test runner. The local environment was aligned and all Python tests rerun. |
| Installed Python packages | `pip check` reports no broken installed requirements. This checks package consistency, not the installation/execution of optional notebooks or Jupyter tooling. |

## Verification

- 111 web tests passed, including 10 API-routing regression tests.
- The tests exercise actual Vite middleware with the real existing handler modules,
  using deliberately invalid inputs that return JSON before any external calls.
- Type checking and the production build passed.
- Dataset validation passed; all 13 numerical Python-reference comparisons passed.
- All 27 Python pipeline tests passed with pytest 8.3.4.
- Browser checks showed no Vite overlays on Workbench, Global explorer, Experience,
  Methods, Game, or Game admin. Workbench POWER temperature data and statistics loaded.
- Decimal-coordinate API requests now return HTTP/JSON responses rather than module
  transform errors. No saved game questions were changed during these checks.

## Separate upstream/configuration limitations observed

| Feature | Actual local result after the routing fix |
| --- | --- |
| Workbench Giovanni haze | Local API returned JSON HTTP 502 describing an upstream Giovanni HTTP 500. An Earthdata token is configured, but service success was not established. |
| Flood context | JSON HTTP 500: `SPHERE_KEY is not configured`. |
| Saved game questions/admin | JSON HTTP 502; local Redis REST URL/token are not configured. The game renders its existing fallback questions; admin reports the unavailable database. |

These are separate from the compilation error. Successful live verification of
Giovanni still requires a successful upstream response; flood and saved-question
verification require their local server credentials. The audit does not claim
those integrations are fully operational.
