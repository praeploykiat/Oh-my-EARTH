# Giovanni time-series investigation

Investigated November 15, 2026 (Asia/Bangkok). Further credential changes and
upstream access work were deferred at the user's request. No token was saved,
replaced, or printed. Temporary credential-setup tooling was stopped and removed.

## Verified findings

| Check | Observed result |
| --- | --- |
| NASA configured-variable catalog | HTTP 200. Captured public catalog at `fixtures/giovanni-configured-variables.json`. |
| Original monthly MERRA-2 haze request | HTTP 500 with `{"message":null}`. Its product `M2TMNXAER_5_12_4_TOTEXTTAU` is absent from the point-service catalog. |
| Supported hourly MERRA-2 haze request, short period | Same HTTP 500 using the configured generated Earthdata token. |
| Supported monthly GLDAS and GPM requests, short period | Same HTTP 500 using the configured generated Earthdata token. Adding explicit product versions did not resolve it. |
| NASA's published GLDAS tutorial request, called directly outside our proxy | Same HTTP 500. This reproduces the remaining failure without the application or its Python pipeline. |
| Request without a token | HTTP 403 with a bad/missing-token message. |
| Configured token metadata | Earthdata issuer and future expiration are present. These checks alone do not prove a token is accepted by Giovanni. |
| CMR request with configured token | HTTP 200. This does not establish Giovanni-specific access. |
| Interactive NASA GESDISC sign-in | A supported runoff request returned CSV containing timestamped observations. Server requests with the existing generated token still returned HTTP 500 afterwards. |

The browser OAuth path and the generated-token server path behave differently.
The exact reason for that difference remains unresolved; a provider-side failure,
token compatibility, or application/account access cannot be distinguished from
the empty upstream error alone. We do not classify the generated token as invalid
solely from the HTTP 500 response.

## Limited code correction retained

Haze now requests the catalog-listed `M2T1NXAER_5_12_4_TOTEXTTAU` product directly.
The unsupported monthly MERRA-2 and MODIS candidates were removed. Its source label
now accurately describes hourly data averaged into monthly observations. A unit
test checks every configured workbench product against the captured NASA catalog.

The broader proxy/authentication rewrite was reverted. The existing Earthdata token
configuration and API handler behavior are preserved. The retained catalog correction
is not a claim that generated-token live retrieval now succeeds.

## Primary references

- [NASA's configured-variable catalog](https://api.giovanni.earthdata.nasa.gov/configured-variables).
- [NASA's published Python time-series tutorial](https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_to_Access_GiC_Time_Series_Service.ipynb).
- [NASA Giovanni programmatic sign-in](https://api.giovanni.earthdata.nasa.gov/signin).

Future verification should use the desired production credential and confirm valid
2001–2024 numeric monthly observations through the workbench before calling the
integration operational. Missing credentials, unsupported products, and upstream
service errors should be reported distinctly when that work resumes.
