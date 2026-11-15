export const en = {
  "global.mapNavigation":
    "Drag to pan · Scroll or pinch to zoom · Focus map: arrow keys to pan, +/− to zoom, Home to reset",
  "global.co2.descriptive": "Descriptive trend estimate",
  "global.co2.minimum":
    "Choose at least three complete calendar years to estimate a descriptive rate. Incomplete records remain unavailable.",
  "global.co2.rateNote":
    "Estimated from {years} observed years ({start}–{end}), with the rate rescaled to ten years for comparison. This is not ten years of observations or a forecast.",
  "global.co2.trendMethod":
    "Seasonal Sen’s slope compares matching calendar months between years and takes the median of their pairwise rates. The same monthly estimator is used for monthly, annual and anomaly views.",
  "global.co2.noInference":
    "Short record: no confidence interval, p-value or statistically supported direction is reported. The existing significance method requires at least ten complete years.",
  "global.co2.mapNote":
    "Blue = decreasing; red = increasing descriptive rate in ppm per decade. All markers are hollow: direction is not statistically established. Rate comes from matching-month seasonal Sen slopes; a per-decade unit does not imply ten observed years.",
  "global.co2.chartNote":
    "Monthly mean CO₂ in the selected calendar year. Gold points mark monthly extrema. Select Trend per decade for a descriptive rate over a selected period.",

  "global.co2.quality":
    "OCO-2 GEOS column-average CO₂: source product, DOI, units, actual grid centre and calendar completeness are validated. Monthly means require every daily value. Fill values remain gaps; there is no interpolation. These are numerical screening checks, not retrieval-level QA or a scientific accuracy guarantee.",

  "global.co2.source": "NASA OCO-2 GEOS · Product documentation",
  "global.co2.noTrend":
    "CO₂ trends are disabled: only seven complete years (2015–2021) are available; the trend method requires at least ten.",
  "global.co2.note":
    "OCO-2 GEOS assimilated dry-air column-average CO₂, in ppm. This combines satellite retrievals and atmospheric modelling; it is not surface concentration, local air pollution or national emissions. Annual averages are weighted by calendar days and require 12 complete months. Lowest/highest refer to monthly means, not daily extremes.",

  "global.giovanni.eyebrow": "NASA Giovanni · Model and reanalysis data",
  "global.giovanni.source": "NASA Giovanni · Source request ↗",
  "global.giovanni.etTotal": "Annual evapotranspiration total",
  "global.giovanni.etMissing":
    "This GLDAS cell has no valid evapotranspiration data for 2001–2024. Coastal and island cells may lack model land coverage. Missing values are not zeros, and no neighbouring cell has been substituted.",
  "global.giovanni.etBasis":
    "Trend and significance use complete annual evapotranspiration totals, in mm/year per decade. Monthly and anomaly views instead test monthly mean daily rates.",
  "global.giovanni.etNote":
    "GLDAS Noah 2.1 modelled evapotranspiration: monthly mean rates in mm/day, annual totals in mm/year. Lowest/highest months compare monthly totals in mm/month. Signed rates are preserved: negative values can represent net condensation. Complete months and all 12 months are required for yearly summaries. These are grid-cell estimates, not measured crop water use or drought diagnoses.",
  "global.giovanni.aodNote":
    "MERRA-2 reanalysis aerosol optical depth at 550 nm, dimensionless. Every expected hourly value must be valid before a monthly mean is published. Annual averages are weighted by calendar days. This describes the atmospheric aerosol column, not surface PM2.5 or an air-quality index. The quality panel reports the actual 0.5° × 0.625° cell centre.",
  "global.giovanni.quality":
    "Giovanni access to separately identified MERRA-2 and GLDAS datasets. Product, parameter, units, period and exact source grid cell are checked. Missing/fill values remain gaps; invalid values are excluded. AOD requires complete hourly coverage for each monthly mean. ET is converted from kg/m²/s to mm/day. These screening checks do not establish scientific accuracy. No neighbouring cells are substituted.",
  "global.gldas.eyebrow": "NASA GLDAS · Modelled soil moisture",
  "global.gldas.modelled": "Modelled",
  "global.gldas.missing":
    "This GLDAS cell has no valid soil-moisture values for 2001–2024. Coarse model land coverage can leave coastal and island capitals without data. These gaps are not zeros, and no neighbouring cell has been substituted.",
  "global.gldas.source": "GLDAS Noah 2.1 · Giovanni source request ↗",
  "global.gldas.scope":
    "Modelled water stored in the top 0–10 cm of soil, in kg/m², not a percentage. Monthly values represent a 0.25° GLDAS cell containing the capital coordinate. The quality panel shows its actual centre. These are model estimates, not direct satellite or field measurements; they do not describe national conditions or establish drought. Lowest and highest refer to monthly means, not daily extremes.",
  "global.gldas.quality":
    "GLDAS Noah 2.1 monthly soil moisture (0–10 cm). Product, units, dates and the containing grid cell are validated. Fill values remain missing; nonfinite or out-of-range values are rejected. Screening uses 0–100 kg/m² and is not a scientific accuracy guarantee. Giovanni supplies no per-month quality flags here. Neighbouring cells are never substituted. Frozen soils, model forcing and land representation can affect interpretation.",
  "cache.reload": "Reload published data",
  "cache.calculateMap": "Calculate map for this range",
  "cache.coverage": "Published coverage: {count}/{total} capital coordinates.",
  "cache.mapReady":
    "Prepared map loaded · {count} capitals have usable values.",
  "cache.mapLoading": "Loading prepared map…",
  "cache.mapError":
    "The prepared map could not be loaded. Reload published data to retry.",
  "cache.published":
    "Data release published: {date}. Reload to check for a newer published release.",
  "cache.loadingNote":
    "Maps and monthly records load from saved, validated observations. Default-period trends and annual maps are prepared in advance. Custom-range maps calculate from saved records; normal exploration never starts a NASA extraction.",
  "cache.controls":
    "Choose a location and period to explore saved observations. New data appears when an updated dataset is published.",
  "cache.loadingCapital": "Loading saved observations for {place}…",
  "cache.unavailable":
    "This location has no published observations for the selected variable yet. Explore an available location while background ingestion prepares more coverage.",
  "cache.unavailablePoint": "Observations not published for this location yet.",
  "cache.openAvailable": "Explore saved data at {city}",
  "cache.failed": "Saved observations could not be loaded.",
  "cache.retryHelp":
    "Retry or reload the published release. The last validated release remains available while source updates are processed.",
  "cache.quality":
    "Validated POWER observations from the published database release. Source screening, missing values and retrieval timestamps are preserved.",
  "cache.units": "Stored units",
  "cache.snapshot":
    "Published release: {date}. Reloading checks for a newer release; it does not request new observations from NASA.",
  "cache.download": "Download saved monthly data",
  "global.ndvi.availability":
    "Published NDVI coverage: {count}/{total} capital coordinates. Unpublished locations remain unavailable; no neighboring point is substituted.",
  "global.ndvi.unavailablePoint":
    "NDVI extraction not published for this capital yet.",
  "global.ndvi.unavailable":
    "This capital has no published NDVI extraction yet. The current snapshot is a pilot; choose an available location to inspect real observations.",
  "global.ndvi.openAvailable": "Explore NDVI at {city}",
  "global.ndvi.qualityTitle": "NDVI data quality and provenance",
  "global.ndvi.source": "NASA MODIS · AppEEARS source ↗",
  "global.ndvi.download": "Download validated NDVI snapshot",
  "global.ndvi.eyebrow": "Terra MODIS · NDVI pilot · Monthly observations",
  "global.ndvi.scope":
    "NDVI is a unitless vegetation-greenness index for the sampled approximately 1 km pixel at the capital coordinate. That pixel may include urban land. It is not national vegetation cover or a direct drought measurement. Cloud, snow, water and poor-quality observations remain gaps.",
  "global.ndvi.quality":
    "MOD13A3.061 monthly NDVI composites from AppEEARS. Values are already scaled. Conservative QA retains only reliability 0, good MODLAND quality, land pixels, and no adjacent/mixed cloud, snow/ice or shadow flags. Missing and rejected months are never interpolated.",
  "global.ndvi.snapshot":
    "Source: validated AppEEARS extraction snapshot, not a new live extraction. The coordinates below are requested sampling coordinates, not a pixel centroid. Rebuild the snapshot in the Python pipeline to update NASA observations.",
  "global.ndvi.reload": "Reload published NDVI snapshot",
  "global.ndvi.meanNote":
    "Each annual average uses the year’s 12 monthly NDVI composites, weighted by calendar days. All 12 must pass validation and QA. NDVI is unitless; fixed scale −0.2 to 1.",
  "global.ndvi.extremeNote":
    "Lowest/highest monthly NDVI composite in the selected year, not an individual daily extreme. All 12 months must pass validation and QA; tied months are listed. Fixed scale −0.2 to 1.",
  "global.ndvi.monthlyNote":
    "Monthly NDVI composites; cloud and QA exclusions remain gaps. Values are unitless and are not multiplied by the source scale factor again.",
  "global.ndvi.loadingNote":
    "NDVI loads from a published, validated NASA AppEEARS extraction snapshot. Load all reuses that file; it does not submit 195 extraction jobs. Updates require rebuilding the snapshot.",
  "global.map.total": "Annual rainfall total",
  "global.map.lowest": "Lowest month",
  "global.map.highest": "Highest month",
  "global.map.singleYear": "Calendar year",
  "global.map.year": "Selected year",
  "global.map.extremeNote":
    "Lowest/highest of the 12 monthly means in the selected year, not an individual daily extreme. All 12 months must be valid; tied months are listed. Fixed scale; values beyond the endpoints use the end color.",
  "global.map.rainExtremeNote":
    "Lowest/highest monthly rainfall total in the selected year (mm/month), estimated as the monthly average daily rainfall × days in that month. All 12 months must be valid; tied months are listed. Fixed scale; values beyond the endpoints use the end color.",
  "global.map.yearIncomplete":
    "A complete 12-month record is required for this annual summary. Available months are shown below; missing values are not treated as zero.",
  "global.map.monthlyChart": "Monthly values in the selected year",
  "global.map.yearChartNote":
    "The chart shows this calendar year. Gold points identify every month matching the selected minimum or maximum. Switch to Trend to investigate long-term change.",
  "global.map.interval": "95% exploratory interval",
  "global.map.mode": "Map coloring",
  "global.map.average": "Annual average",
  "global.map.trend": "Trend per decade",
  "global.map.load": "Load all capitals / retry failures",
  "global.map.stop": "Stop loading",
  "global.map.progress":
    "{loaded}/{total} locations loaded · {painted} colored · {failed} fetch failures",
  "global.map.legend": "Map color legend",
  "global.map.decade": "decade",
  "global.map.trendNote":
    "Blue = decreasing; red = increasing. Filled dots: direction supported across tested blocks. Hollow colored rings: inconclusive, sensitive, or limited evidence; color shows the estimate, not certainty. Zero does not prove no change. Same method as the chart; exploratory intervals may understate uncertainty. Fixed scale: values beyond the endpoints use the end color. Individual tests are not adjusted for multiple locations.",
  "global.map.meanNote":
    "Day-weighted average of the 12 monthly means in the selected year. All 12 months must be valid. Fixed scale; values beyond the endpoints use the end color.",
  "global.map.rainNote":
    "Estimated annual rainfall total: sum of monthly average daily rainfall × days in each month. All 12 months must be valid. Fixed scale; values beyond the endpoints use the end color.",
  "global.map.symbols":
    "Dashed gray ring: not loaded, calculating, insufficient data, or fetch failure (hover or focus for status). Gold halo: selected capital. Points represent capital coordinates, not national averages.",
  "global.map.loadingNote":
    "Load all is optional: two requests at a time, cached for this session. Stop prevents new requests; in-flight requests may finish. Variable and period changes reuse loaded records.",
  "global.map.failed":
    "Request or calculation failed; retry loading or change settings.",
  "global.map.insufficient": "Insufficient data for this summary.",
  "global.map.pending": "Not loaded or calculating.",

  "global.trend.title": "What does this record suggest?",
  "global.trend.up":
    "At the {city} capital coordinate, {variable} increased at an estimated {rate} {unit} per decade over {start}–{end}.",
  "global.trend.down":
    "At the {city} capital coordinate, {variable} decreased at an estimated {rate} {unit} per decade over {start}–{end}.",
  "global.trend.flat":
    "At the {city} capital coordinate, the estimated rate of change in {variable} is {rate} {unit} per decade over {start}–{end}.",
  "global.trend.increase":
    "The resampling analysis supports an increase under the tested block lengths. This does not establish its cause.",
  "global.trend.decrease":
    "The resampling analysis supports a decrease under the tested block lengths. This does not establish its cause.",
  "global.trend.inconclusive":
    "The evidence is inconclusive: the interval includes zero or the resampling test does not support a clear direction. This is not proof that nothing changed.",
  "global.trend.limited":
    "This record has limitations that make the interval and p-value provisional. A confident direction is not assigned, even if the numerical test passes a threshold.",
  "global.trend.warning.gaps":
    "Missing observations are resampled with their year blocks. Simulation checks found weaker interval coverage with gaps, so treat these results cautiously.",
  "global.trend.warning.persistence":
    "Residual correlation is very strong (absolute lag-1 ≥ 0.8). The tested blocks may not capture longer dependence; uncertainty can still be understated.",
  "global.trend.warning.short":
    "Fewer than 15 years provide few independent year blocks. These exploratory limits are especially uncertain.",
  "global.trend.sensitive":
    "The conclusion changes with the block length used to represent serial dependence. Treat the direction as uncertain.",
  "global.trend.intervalExplanation":
    "The approximate 95% interval for the rate is {lower} to {upper} {unit} per decade. It describes uncertainty in the estimated trend, not the range of future observations.",
  "global.trend.interval": "Approximate 95% slope interval",
  "global.trend.pValue": "Block-bootstrap p-value",
  "global.trend.testName": "Two-sided Kendall score test",
  "global.trend.diagnostics": "Method, serial dependence, and sensitivity",
  "global.trend.seasonalMethod":
    "Monthly comparisons match January with January, February with February, and so on. The pooled seasonal Sen estimate uses only these within-month slopes; different months may still behave differently.",
  "global.trend.annualMethod":
    "Annual rainfall totals use non-seasonal Sen’s slope and a Kendall score. Missing years retain their elapsed-time positions.",
  "global.trend.bootstrap":
    "For each tested block length, {count} resamples keep consecutive {years}-year blocks of detrended residuals together for the primary result. This preserves local serial dependence and cross-month relationships within blocks.",
  "global.trend.lag1":
    "Lag-1 correlation of detrended, season-adjusted residuals: {value}. Missing observations are never joined as adjacent pairs.",
  "global.trend.undefined":
    "undefined for constant or insufficient residual pairs",
  "global.trend.monthRange":
    "Descriptive month-specific slopes range from {lower} to {upper} {unit} per decade.",
  "global.trend.opposingMonths":
    "Month-specific point estimates include both signs. The pooled slope can hide seasonal differences; this is not a formal test of differences between months.",
  "global.trend.sensitivity": "Sensitivity to block length (* primary result)",
  "global.trend.blockYears": "Years per block",
  "global.trend.primaryNote":
    "The displayed interval and p-value use the primary block length. Direction is described as supported only when p < 0.05 and the interval excludes zero for every tested block length, without gap, strong-persistence, or short-record flags. These extra flags are conservative product safeguards.",
  "global.trend.version": "Method: {method}. Reproducible random seed: {seed}.",
  "global.trend.reference": "Seasonal slope reference · SciPy",
  "global.trend.calculating":
    "Estimating trend uncertainty with year-block resampling… The chart remains available.",
  "global.trend.failed":
    "Uncertainty could not be estimated for this record. Try a longer period or another location; no uncorrected significance result has been substituted.",
  "global.locationData": "Capital coordinate source data",
  "global.timeRange": "Analysis period",
  "global.startYear": "Start year",
  "global.endYear": "End year",
  "global.rangeAvailable":
    "Available: {start}–{end}. Changing years reuses the loaded record.",
  "global.yearlyTotal": "Yearly total",
  "global.completeYears": "{count} of {total} years are complete",
  "global.rainAggregation":
    "Annual rainfall total: monthly daily rates × days in each month, summed in mm/year. Requires all 12 valid months; incomplete years are gaps.",
  "global.meanAggregation":
    "Annual mean weighted by days in each month, including leap years. Requires all 12 valid months; incomplete years are gaps.",
  "global.anomalyBaseline":
    "Anomalies are relative to each calendar month’s mean within {start}–{end}. The baseline changes with the selected period.",
  "global.monthlyValues":
    "Monthly observations for {start}–{end}. Missing and rejected values remain gaps.",
  "global.insufficient":
    "Trend statistics withheld: select at least 10 years with 80% valid months. Annual rainfall trends also require 10 complete years. You can still explore the available observations.",
  "global.annualTrendBasis":
    "Trend and significance use complete annual rainfall totals, in mm/year per decade. They differ from trends in monthly daily rainfall rates.",
  "global.monthlyTrendBasis":
    "Trend estimation compares matching calendar months within the selected period, including when the chart shows annual means. The anomaly baseline affects the display, not the seasonal trend test.",
  "global.qualityTitle": "Data quality and provenance",
  "global.qualityIntro":
    "Checks cover response structure, location, units, month keys, missing values, finite numbers, and broad plausibility bounds. Rejected values are excluded. These checks do not establish measurement accuracy.",
  "global.qualityPeriod": "Selected period: {start}–{end}",
  "global.sourceUnit": "Source units",
  "global.valid": "Valid months",
  "global.missing": "Missing",
  "global.rejected": "Rejected",
  "global.retrieved":
    "Retrieved: {date}. This timestamp is preserved when the response is cached.",
  "global.requestedCoordinates": "Requested capital coordinate: {lat}, {lon}",
  "global.responseCoordinates":
    "API response coordinate: {lat}, {lon} (not a national average)",
  "global.refresh": "Refresh NASA data",
  "global.eyebrow": "NASA POWER · Global observations",
  "global.title": "A world of change to investigate",
  "global.intro":
    "Choose a capital city, explore its environmental record, and test the long-term trend.",
  "global.period": "Monthly historical record",
  "global.scope":
    "Each marker represents gridded observations at a capital-city coordinate. These are not country-wide averages or local weather-station measurements.",
  "global.investigate": "Start an investigation",
  "global.search": "Find a country or capital",
  "global.searchPlaceholder": "Search countries or cities…",
  "global.location": "Country · representative capital",
  "global.matches": "{count} matching locations",
  "global.variable": "Environmental variable",
  "global.onDemand":
    "{count} locations. Select a city to load its record, or choose Load all capitals for map comparisons.",
  "global.view": "Time-series view",
  "global.mapHint": "Select a country or capital marker",
  "global.mapLabel":
    "World map of representative capital cities. Use the country selector for keyboard selection.",
  "global.zoomIn": "Zoom in",
  "global.zoomOut": "Zoom out",
  "global.reset": "World",
  "global.mapFailed":
    "The map could not load. You can still select a country from the list.",
  "global.capitalMarker": "Capital-city location",
  "global.fetchFailed": "NASA POWER data is unavailable for this selection.",
  "global.fetchHelp":
    "The request may have timed out or failed validation of its structure, units, or location. Retry or inspect the source request.",
  "global.source": "NASA POWER · View source request ↗",
  "global.validMonths": "{count} of {total} months have valid observations",
  "global.caution":
    "Intervals and p-values are approximate. Year-block resampling addresses local serial dependence, but assumes roughly stationary detrended residuals and a common long-term slope. Short records, persistent dependence, and structural changes can still mislead. These results do not describe a country-wide trend or establish causation.",
  "global.about": "About the locations, annual values, and trend method",
  "global.method":
    "Monthly records use within-calendar-month Kendall comparisons and a seasonal Sen slope. Annual rainfall uses annual comparisons. A circular residual bootstrap resamples whole-year blocks and calibrates the two-sided Kendall score test and approximate 95% Sen slope limits. Neighboring block lengths are checked for sensitivity. This is an exploratory block-bootstrap method, not the 3PW prewhitening algorithm.",
  "global.annual":
    "The global explorer requires 12 valid months for an annual value. Temperature, humidity, and daily solar energy use day-weighted annual means. Rainfall rates are multiplied by calendar days and summed to annual totals. Partial years are not scaled or filled. Anomalies use calendar-month means over the selected period. The Thailand workbench retains its existing aggregation.",
  "global.geography":
    "The bundled catalog uses the 195 entries marked independent in a REST Countries snapshot, with one representative capital coordinate per entry. For South Africa, Pretoria is used. Locations and simplified map boundaries are for exploration, not a statement about sovereignty. Small island locations remain selectable even where the map omits their outlines.",
  "app.title": "Oh my EARTH!",
  "nav.experience": "Experience",
  "nav.workbench": "Thailand explorer",
  "nav.main": "Main navigation",
  "language.label": "Language",

  "status.loading": "Loading…",

  "chart.label": "Time series in {unit}",
  "chart.noData": "No data",
  "chart.observed": "Observed",
  "chart.trend": "Sen's slope",

  "stats.trend": "Trend",
  "stats.perDecade": "{unit} per decade",
  "stats.pValue": "p-value",
  "stats.mannKendall": "Mann-Kendall test",
  "stats.verdict": "Verdict",
  "stats.significant": "Significant",
  "stats.notSignificant": "Not significant",
  "stats.record": "Record",
  "stats.points": "{count} data points",

  "source.label": "Source",
  "source.synthetic": "Synthetic sample",

  "resolution.monthly": "Monthly",
  "resolution.annual": "Annual",

  "landing.eyebrow": "NASA Space Apps Challenge 2026, Thailand",
  "landing.bridge":
    "Heat rarely changes alone. Rain, soil and haze move with it.",
  "landing.playAsk": "Where do trends go next, and which travel together?",
  "landing.seeAsk": "Where is change strongest?",
  "landing.investigateAsk": "Is it real where you live?",
  "hotspot.title": "Where is change strongest?",
  "hotspot.intro":
    "Trends from {start} to {end} at {count} places on land, one every {grid}°, tested the same way as the World explorer.",
  "hotspot.loading": "Loading hotspots…",
  "hotspot.noData":
    "The hotspot data has not been built yet. Run npm run build:hotspots, then reload this page.",
  "hotspot.mapLabel": "World map showing places with a clear trend",
  "hotspot.legend": "Change per decade ({unit})",
  "hotspot.clear": "{clear} of {total} places show a clear trend",
  "hotspot.note":
    "Only places with a clear, tested trend are shown. Empty land means no clear trend. Red is rising, blue is falling, and bigger dots change faster. Each dot is one grid point, not a country average.",
  "hotspot.perDecade": "{value} {unit} per decade",
  "hotspot.unitNote": "Values in {unit} per decade",
  "hotspot.up": "Clear rise",
  "hotspot.down": "Clear fall",
  "hotspot.range": "95% range {lower} to {upper}",
  "hotspot.notClear": "No clear trend here for this measurement.",
  "hotspot.pick": "Click a dot to see its numbers.",
  "hotspot.rising": "Fastest rising",
  "hotspot.falling": "Fastest falling",
  "hotspot.none": "None found.",
  "hotspot.openThailand": "Open in Thailand explorer",
  "hotspot.openWorld": "Open {city} in World explorer",
  "hotspot.gesture":
    "Drag to turn the globe, scroll to zoom, click a dot for details",
  "hotspot.reset": "Reset view",
  "hotspot.close": "Close",
  "hotspot.soon":
    "This map is on its way. Until then, the Thailand explorer can test any province for a trend.",
  "landing.seeCta": "Open the map",
  "landing.title": "Is Earth really changing?",
  "landing.start": "Start",
  "landing.openWorkbench": "Open workbench",
  "landing.howTitle": "How the explorers work",
  "landing.step1.title": "Live it",
  "landing.step1.body":
    "Every outcome in the story is weighted by real satellite and model data for that place and year.",
  "landing.step2.title": "Notice it",
  "landing.step2.body":
    "Play again and again. Patterns start to appear before any chart is shown.",
  "landing.step3.title": "Prove it",
  "landing.step3.body":
    "See the data behind every life, then test whether the change is statistically significant.",

  "experience.play": "Play",
  "experience.playPlaceholder":
    "Game mechanics will be driven by the dataset values.",
  "experience.finish": "Finish",
  "experience.revealTitle": "What you just lived through",
  "experience.playAgain": "Play again",
  "experience.investigate": "Investigate yourself",

  "workbench.title": "Workbench",

  "map.label": "Map of Thailand by province",
  "map.hint": "Click a province on the map",
  "map.selectProvince": "Choose a province",

  "workbench.question": "What is changing, and where?",
  "workbench.intro":
    "NASA data for Thailand from 2001 to 2024, tested for real change.",
  "workbench.featured": "Featured cases",
  "workbench.caseNumber": "Case {number}",
  "workbench.place": "Place",
  "workbench.comparePlace": "Compare with",
  "workbench.compare": "Compare another place",
  "workbench.removeCompare": "Remove comparison",
  "workbench.pickPlace":
    "Choose a province or open the map to start investigating.",
  "view.label": "Chart view",
  "view.annual": "Yearly average",
  "view.monthly": "Monthly",
  "view.anomaly": "Without seasons",
  "chart.decadeMean": "Decade average",
  "decades.change": "Change",
  "verdict.rising":
    "{variable} in {place} has risen by {value} {unit} per decade since {year}.",
  "verdict.falling":
    "{variable} in {place} has fallen by {value} {unit} per decade since {year}.",
  "verdict.flat":
    "{variable} in {place} has stayed about the same since {year}.",
  "verdict.veryUnlikelyChance":
    "A change this steady is very unlikely to be chance.",
  "verdict.unlikelyChance": "A change this steady is unlikely to be chance.",
  "verdict.notProven": "But the data cannot rule out chance yet.",
  "state.fetching": "Acquiring NASA data for {place}…",
  "state.saved":
    "Could not reach the NASA data service right now, so this shows saved data for this place.",
  "state.noData":
    "Could not reach the NASA data service, and there is no saved data for this place yet.",
  "state.failed": "Something went wrong while loading this data.",
  "state.retry": "Try again",
  "source.live": "Live",
  "source.saved": "Saved copy",
  "info.label": "What is this?",
  "info.trend":
    "How fast the value changes over ten years, using the median of all year-to-year slopes so a few odd years cannot skew it.",
  "info.pValue":
    "The chance of seeing a trend this steady if nothing were really changing. Smaller means stronger evidence.",
  "info.verdict":
    "Significant means the p-value is below 0.05: the trend is unlikely to be random ups and downs.",
  "info.anomaly":
    "Every place is hotter or wetter in some months. Removing that yearly cycle shows the long-term change underneath.",

  "footer.team": "Far Side of the Moon",
  "footer.event": "NASA Space Apps Challenge 2026, Bangkok",
  "footer.links": "Project links",
  "footer.challenge": "Challenge",
  "footer.data": "Data: NASA",
  "footer.source": "Source code",
  "footer.disclaimer":
    "Built for the NASA Space Apps Challenge using NASA open data. Not affiliated with or endorsed by NASA.",
  "nav.global": "World explorer",
  "nav.hotspot": "Hotspot map",
  "nav.home": "Home",
  "landing.lead": "Guess first, then let the data answer.",
  "landing.ask": "Phuket air temperature",
  "landing.unit": "°C, yearly average",
  "landing.chartLabel":
    "Phuket yearly air temperature from NASA POWER, with space to draw your guess",
  "landing.drawHint": "What do you think happened next?",
  "landing.legendKnown": "NASA record",
  "landing.legendGuess": "Your guess",
  "landing.legendReal": "What really happened",
  "landing.reveal": "Show me",
  "landing.again": "Draw again",
  "landing.warmed":
    "Phuket is about {total} °C warmer than in {year}. That is roughly {value} °C every 10 years.",
  "landing.cooled":
    "Phuket is about {total} °C cooler than in {year}. That is roughly {value} °C every 10 years.",
  "landing.real": "The change is too steady to be luck.",
  "landing.notSure":
    "The years swing up and down a lot, so this could still be luck.",
  "landing.gapClose":
    "Your line stayed close to the real one. Nice detective work.",
  "landing.gapAbove": "On average your line was {value} °C above the real one.",
  "landing.gapBelow": "On average your line was {value} °C below the real one.",
  "landing.tryProvince": "Check your own province",
  "landing.tryGame": "Play more",
  "landing.loading": "Loading Phuket’s record from NASA…",
  "landing.offline":
    "NASA’s server did not answer just now, so the chart cannot load.",
  "landing.chartSource": "Data: NASA POWER (MERRA-2), 7.88°N 98.39°E",
  "landing.waysTitle": "Follow the clues",
  "landing.playVerb": "Guess",
  "landing.playText":
    "Every question has a tested trend. See a record up to a year and draw what comes next, or see one measure and draw the one that moves with it.",
  "landing.playCta": "Start playing",
  "landing.seeVerb": "Discover",
  "landing.seeText":
    "A globe of 632 places on land. The deepest red and blue dots are where change is clearest.",
  "landing.soon": "Coming soon",
  "landing.investigateVerb": "Investigate",
  "landing.investigateTitle": "World and Thailand explorers",
  "landing.investigateText":
    "Pick any place and measurement, see 20+ years of NASA data and test the trend in one click.",
  "landing.worldCta": "Explore the world",
  "landing.thailandCta": "Explore Thailand",
  "landing.step1": "Pick a place and a measurement",
  "landing.step1Text":
    "Rain, heat, haze, soil moisture and more, for any province or capital city.",
  "landing.step2": "See the record",
  "landing.step2Text":
    "Every month since 2001, from NASA satellites and models.",
  "landing.step3": "Test the trend",
  "landing.step3Text":
    "We remove the seasons, fit a trend line and check whether the change is bigger than chance.",
  "landing.methodsLink": "How we test, step by step",
  "landing.sourcesTitle": "Data from",
  "nav.methods": "Methods",
  "nav.game": "Guess the graph",
  "game.question": "When {given} changes, what happens to {hidden}?",
  "game.stepGiven": "Here is what we know",
  "game.stepDraw": "Your turn",
  "game.stepAnswer": "The answer",
  "game.drawTitle": "Draw your line on the chart below",
  "game.answerTitle": "Here is how it really goes",
  "game.tip": "Press and drag from left to right",
  "game.source": "Data: {source}",
  "game.submit": "I’m done",
  "game.startOver": "Start over",
  "game.yourLine": "Your guess",
  "game.realLine": "Real data",
  "game.realPeak": "Real peak",
  "game.outOf": "out of 100",
  "game.great": "Spot on. You read the Earth well.",
  "game.good": "Not bad. You got the general shape.",
  "game.tryAgain": "The real pattern surprised you.",
  "game.peak": "Highest point: really {actual}, you drew {guess}.",
  "game.lowest": "Lowest point: really {actual}, you drew {guess}.",
  "game.verdict.right": "Exactly right",
  "game.verdict.close": "One step off",
  "game.verdict.off": "Missed",
  "game.gap": "On average your line was {value} {unit} away from the real one.",
  "game.why": "Why it works like this",
  "game.how":
    "Score: 100 means your line sits on the real one. Points drop as the average gap grows, and reach 0 when the gap is 30% of the chart’s height.",
  "game.next": "Next question",
  "game.skip": "Skip this question",
  "game.question.n": "Question {n}",
  "game.stats": "{n} played · average score {average}",
  "source.crossCheck": "Cross-check",
  "methods.title": "Methods",
  "methods.heading": "How we detect a trend",
  "methods.intro":
    "Every trend on this site is computed from public NASA data. The Thailand explorer, the World explorer and the Hotspot map use different tests, described below.",
  "methods.step1.title": "Remove the seasons",
  "methods.step1.body":
    "Monthly data rise and fall with the seasons. We subtract each calendar month’s long-term average so only the change between years is left.",
  "methods.step2.title": "Test for a steady direction",
  "methods.step2.body":
    "The Mann-Kendall test compares every pair of years and asks whether later values are consistently higher or lower. It returns a p-value; below 0.05 we call the trend significant.",
  "methods.step3.title": "Measure how fast",
  "methods.step3.body":
    "Sen's slope takes the median of every pairwise slope, so a single extreme year cannot drag the result. We report it per decade.",
  "methods.limits.title": "Limits",
  "methods.limits.body":
    "Model data such as MERRA-2 and GLDAS describe a grid cell, not a single weather station. The Thailand explorer test does not allow for months that depend on each other, which can make p-values look stronger than they are. The Hotspot map tests 632 places for each measurement, so a few clear results can appear by chance. A trend does not explain its cause.",
  "methods.data.title": "Data we use",
  "methods.data.variable": "Variable",
  "methods.data.product": "Product",
  "methods.data.access": "Access",
  "methods.access.direct": "Direct from NASA POWER",
  "methods.access.proxy": "Through our server with an Earthdata token",
  "methods.reading.title": "Further reading",
  "source.satellites": "Satellites: {satellites}",
  "source.model": "Model blending satellite and ground data",
  "layer.atmosphere": "Atmosphere",
  "layer.atmosphereHint": "The air above us",
  "layer.ground": "Near the ground",
  "layer.groundHint": "Measured 2 m above the ground",
  "layer.surface": "Surface and soil",
  "layer.surfaceHint": "Land and water",
  "workbench.mapTarget": "Clicking the map sets the highlighted place.",
  "badge.real": "Real change",
  "badge.notProven": "Not proven yet",
  "share.button": "Share this finding",
  "share.copy": "Copy link",
  "share.copied": "Link copied",
  "chart.saveImage": "Save image",
  range: "{from} to {to}",
  "flood.title": "Flood years",
  "flood.thisArea": "This subdistrict",
  "flood.summary": "{place} flooded in {count} of {total} years ({years}).",
  "flood.none": "{place} had no recorded floods from {from} to {to}.",
  "flood.note":
    "Flood maps from GISTDA satellites, shown for context. Not part of the trend test.",
  "landing.ctaGame": "Play Guess the graph",
  "landing.perDecade": "°C per 10 years",
  "landing.stampReal": "Real trend",
  "landing.stampUnsure": "Could be luck",
  "landing.warmest": "{year}: warmest year here",
  "game.stamp.great": "Spot on",
  "game.stamp.good": "Close call",
  "game.stamp.off": "Keep digging",
  "game.extend.question": "What happens to {measure} after {until}?",
  "game.extend.drawTitle": "Draw how the line goes on",
  "game.extend.tip": "Draw the rest",
  "game.extend.known": "The record so far",
  "game.extend.direction": "Direction: really {actual}, you drew {guess}.",
  "game.extend.dir.up": "rising",
  "game.extend.dir.down": "falling",
  "game.extend.dir.flat": "flat",
  "game.extend.trend":
    "Over the whole record it changed about {value} {unit} every 10 years.",
  "game.extend.real": "Real trend",
  "game.extend.unsure": "Could be luck",
  "landing.waysLead": "Guess, locate, then prove.",
  "landing.drawHint2": "Draw it here",
  "landing.sinceStart": "°C since {year}",
  "landing.src.power": "temperature, rain, humidity, wind, sunlight",
  "landing.src.imerg": "rain seen from satellites",
  "landing.src.gldas": "soil moisture, runoff, evaporation",
  "landing.src.merra": "haze",
  "landing.src.gistda": "flood history in Thailand",
  "footer.by": "Created by",
  "landing.imageCredit": "Earth image: NASA Blue Marble",
  "methods.thailand.title": "Thailand explorer",
  "methods.global.title": "World explorer and Hotspot map",
  "methods.global.step1.title": "Compare the same month across years",
  "methods.global.step1.body":
    "January is compared only with January, February with February, and so on. The median of all those yearly changes is the trend, shown per decade. Rainfall uses complete yearly totals instead.",
  "methods.global.step2.title": "Check it against resampled years",
  "methods.global.step2.body":
    "Whole years of leftover variation are resampled 999 times to give an approximate 95% range for the trend and a p-value. This allows for months that depend on each other.",
  "methods.global.step3.title": "Hold back weak results",
  "methods.global.step3.body":
    "A trend needs at least 10 years and 80% valid months. Short, gappy or strongly persistent records are marked provisional. The Hotspot map shows a place only when the result is a clear rise or fall.",
  "methods.co2":
    "CO₂ in the World explorer covers only 2015 to 2021, so it shows a descriptive slope with no range and no significance test.",
  "methods.game.title": "Guess the graph",
  "methods.game.body":
    "Our team chooses each question and its data, and the source is shown under the chart. Your score compares your line with the real one: 100 means they match, and it drops as the average gap grows. Continue-the-line questions also test the whole record the same way as the Thailand explorer.",
  "methods.data.thailand": "Thailand explorer data",
  "methods.data.global": "World explorer, Hotspot map and Home data",
  "methods.data.coverage": "Coverage",
  "landing.src.oco2": "carbon dioxide in the air, 2015 to 2021",
} as const;

export type MessageKey = keyof typeof en;
