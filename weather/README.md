# Weather Widget

One single-city weather card with optional historical temperatures, foliage and three-year snow history. Interface labels are in Italian. There is one entry page and no build step.

## URL parameters

- `city` (required): city name, e.g. `Kyoto`, `Milano` or `Paris`.
- `country` (optional): two-letter ISO country code; recommended to disambiguate names. Use `JP` for Japan.
- `lat` and `lon` (optional, **both required together**): decimal coordinates for small places not found by the geocoder (latitude −90…90, longitude −180…180). When supplied, weather and snow use these coordinates directly and `city` becomes the display name; include `country=JP` to enable Japanese foliage matching. For example, `city=Hirayu%20Onsen&country=JP&lat=36.19061&lon=137.55175`.
- `start` (optional): first travel date, `YYYY-MM-DD`.
- `end` (optional): last travel date; defaults to `start`.
- `date` (optional): shorthand for a single-day visit.
- `from` / `to`: aliases for `start` / `end`.
- `foliage` (optional): only the exact value `true` enables foliage. Omitted or any other value disables it and skips loading the dataset.
- `snow` (optional): only the exact value `true` enables snow history. Requires valid travel dates. Otherwise no snow requests are made.

Example:

https://sergio-marani.github.io/notion-widgets/weather/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19&foliage=true

## Weather and history

Current weather includes condition, temperature, feels-like temperature and humidity. It refreshes approximately every 30 minutes while the page is visible. With dates, history shows the mean daily high and mean daily low for the same calendar dates in the previous year. February 29 maps to February 28 when necessary. Historical values are context, not a travel forecast.

Without dates, history is hidden. Invalid or reversed dates and intervals longer than 366 days show an error. Current weather, historical weather and section loading failures are handled independently. Foliage and snow loading do not block weather rendering.

At viewport widths of 340 px or less, the weather icon sits above the temperature to leave more room for text. Dividers and spacing are applied only between adjacent visible sections (weather, history, foliage, snow), never after the final section. Section renderers use a `widget-section` wrapper; one shared CSS rule manages separators.

## Optional foliage

Foliage requires `foliage=true`, valid travel dates, a geocoded city matching a dataset record (place name, local name or alias, plus country), and a visit overlapping a recorded tree interval. Overlap is inclusive: `visit.start <= tree.end` and `visit.end >= tree.start`.

Entries in `trees` are evaluated independently, in dataset order. Names are taken directly from each entry; there is no hard-coded species list. A row is hidden outside its interval, for another year, or when its dates are missing or invalid. If no rows qualify, the whole section is hidden. Spring visits therefore do not show autumn foliage. With no travel dates, the JSON is not loaded. A dataset loading failure shows a foliage error for the resolved city while weather/history remain usable.

Each gradient bar represents that tree's explicit start-to-end interval. The white marker is the midpoint of the whole visit, clamped to the bar. The date on the right is the estimated peak. Local place labels come from the dataset when foliage is enabled and dates are supplied.

## Files

Every widget must have `index.html` and `README.md`, use local `style.css` when styling is needed, and initialize in `scripts/widget.js`. Additional modules and data files are allowed.

Keep shared logic in `scripts/`, optional sections in `scripts/sections/`, and each section's JSON data and schema in `data/<section>/`. Use `style.css` rather than `widget.css` or inline style blocks; dynamic per-element values such as the visit marker position may use inline style attributes.

- `index.html`: the only entry page; loads `style.css` and `scripts/widget.js`.
- `style.css`: all card styles, including foliage and compact layout.
- `scripts/widget.js`: composes optional sections from URL parameters and mounts one card.
- `scripts/weather-core.js`: date settings, geocoding, current/historical weather and card rendering.
- `scripts/sections/foliage.js`: dataset loading, city matching, seasonal eligibility and rendering.
- `scripts/sections/snow.js`: archive requests, complete-year validation, snow statistics and compact rendering.
- `data/foliage/data.json`: seasonal data for supported places. See this file for the current city list.
- `data/foliage/schema.json`: JSON Schema describing the dataset format.

## Foliage JSON contract

Example using migrated Kyoto values. This is not a newly verified forecast:

```json
{
  "schemaVersion": 1,
  "updated": "2026-10-01",
  "cities": {
    "kyoto": {
      "countryCode": "JP",
      "placeName": "Kyoto",
      "placeLocalName": "京都",
      "sourceUrl": "https://n-kishou.com/corp/news-contents/autumn/?lang=en",
      "aliases": [
        "Kyōto"
      ],
      "notes": "Optional source context, uncertainty or local coverage.",
      "trees": [
        {
          "name": "Ginkgo",
          "color": "yellow",
          "start": "2026-11-17",
          "peak": "2026-11-27",
          "end": "2026-12-07"
        },
        {
          "name": "Maple",
          "color": "red",
          "start": "2026-11-29",
          "peak": "2026-12-11",
          "end": "2026-12-19"
        }
      ]
    }
  }
}
```

- `schemaVersion`: fixed at `1`.
- `updated`: actual dataset revision date.
- `cities`: records keyed by stable city identifiers.
- Required city fields, in order: `countryCode` (two-letter ISO country code), `placeName`, `placeLocalName`, `sourceUrl` (HTTPS reference for that place). There is no default source or fallback. Optional fields: `aliases` and `notes`. Notes are documentation and are not displayed.
- The format supports any country; the current dataset contains only Japanese cities. `placeName` is the canonical matching name; `placeLocalName` is its local-language label. Matching also accepts aliases and always checks `countryCode`.
- Each city has a non-empty `trees` array. Each entry has a display `name`, a `color` chosen from `yellow`, `orange`, `red`, and its own dates. Names may be Ginkgo, Maple, Larice, Faggio or any other tree; they are rendered exactly as supplied. Omit unsupported trees.
- Colors select fixed gradients in CSS. `yellow` and `red` preserve the previous gradients; `orange` adds a third palette. Color does not depend on the tree name. Only listed, valid, in-season trees appear.
- Tree date fields: `start`, `peak`, `end`, all real ISO dates with explicit year. Required ordering: `start <= peak <= end` and `start < end`.
- `start`: estimated beginning of the visible foliage period; `peak`: estimated best viewing date; `end`: estimated end of the visible foliage period. These are eligibility boundaries as well as bar endpoints; avoid narrow peak-only windows unless intentional.

The migrated dataset preserves the previous peak dates and end overrides. Initial start dates were derived from the old display offsets (ginkgo: peak minus 10 days; maple: peak minus 12 days). Default end dates were peak plus 10/8 days respectively. These intervals are provisional, not independently sourced season predictions. The JSON now stores every boundary explicitly so researched estimates can replace them without code changes.

For an updated forecast, ask the research model to return JSON matching this schema for the cities in the dataset, with explicit year, per-tree name/color/start/peak/end, traceable source URLs, actual revision date, and uncertainty in `notes`. Ask it to distinguish sourced forecasts from inferred estimates and omit unsupported trees rather than invent dates. The widget does not automatically verify or refresh estimates.

## Optional snow history

Example:

https://sergio-marani.github.io/notion-widgets/weather/?city=Takayama&country=JP&start=2026-01-10&end=2026-01-12&snow=true

Add `foliage=true` to combine both sections. Snow supports any city resolved by geocoding, or specified with `lat`/`lon`, and does not depend on the foliage dataset.

The section requests daily `snowfall_sum` in centimeters from the [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) for the same calendar interval one, two and three years before the requested trip. For example, January 10–12, 2026 compares January 10–12 in 2025, 2024 and 2023. Cross-year visits retain both years; February 29 maps to February 28 where necessary.

Each sample must cover the entire shifted interval with consecutive dates, finite non-negative values and confirmed cm units. Missing days, nulls, failed requests and incompatible units exclude that whole year. Periods ending today (UTC) or later are also excluded. Other valid years remain usable. No older replacement years are requested.

- A **snowy day** has at least 0.1 cm of snowfall.
- A **snowy year** has at least one snowy day in its comparison interval.
- **Historical frequency** = snowy years / complete available years, rounded to the nearest percent. With 2 snowy years out of 3 this is 67%; with only 1 complete year the percentage can only be 0% or 100%.
- **Mean cm** = mean total snowfall over the whole comparison interval across available years, including zero-snow years. It is not daily snowfall or snow depth on the ground.
- The three year tiles show each interval's total cm, or `n/d` for unavailable samples. With no complete samples, show an unavailable message instead of 0%.

The card labels this **frequency, not a forecast**. One to three years form a small descriptive sample, not a calibrated probability of future snowfall. Archive data is model-based reanalysis at the selected location; local elevation and mountain conditions can differ. No arbitrary cm progress scale is used: a snowflake, historical percentage and compact year tiles distinguish this section from foliage gradients.

## Preview

From the repository root, run `python -m http.server 8000` and open `/weather/?city=Kyoto&country=JP&date=2026-11-20&foliage=true` on that server. Deploy the entire `weather/` directory.

## Sources

- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- [Japan Meteorological Corporation](https://n-kishou.com/corp/news-contents/autumn/?lang=en)
- [Weathernews](https://weathernews.jp/koyo/)
