# Global explorer geography

## Capital coordinates

`capitals.json` is derived from the REST Countries project:
https://github.com/restcountries/restcountries/blob/master/src/main/resources/countriesV3.1.json

Retrieved November 15, 2026. The transformation retains entries with `independent: true`
and two capital coordinates, selects the first capital, and keeps only country name,
capital name, ISO codes, latitude and longitude. Entries are sorted by country name.
The source snapshot determines coverage and names; this is not a political gazetteer.

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
A copy of the upstream license is distributed at `../licenses/rest-countries-MPL-2.0.txt`.
The derived data is available directly as `capitals.json` in a deployed application.
The application imports an identical build-time copy from `src/core/geo/capitals.json`.
Keep both copies in sync when updating this snapshot.

## Country boundaries

`world-countries.json` is derived from Natural Earth 1:110m countries:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

Retrieved November 15, 2026. Original geometry is retained; properties are reduced to
`ADM0_A3` (renamed `iso3`) and `NAME_EN` (renamed `name`).
Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
