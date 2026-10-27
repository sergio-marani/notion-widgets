# Weather Widget

One weather card for a selected location, with optional historical temperatures, foliage and three-year snow history. Interface labels are in Italian. No build step is required.

## Location and URL parameters

- `place`: stable ID from `data/places/data.json`. Recommended for known locations; uses verified coordinates without geocoding. Takes precedence over `city`, `country`, `lat` and `lon`.
- `city`: free-text city name for locations outside the catalog. Requires at least two characters. Used only when `place` is absent.
- `country`: optional two-letter ISO country filter for `city` searches, e.g. `JP` or `IT`. Recommended to reduce ambiguous results; it does not identify a particular district.
- `lat` and `lon`: optional decimal coordinates, both required together (latitude −90…90, longitude −180…180). Without `place`, weather, history and snow use these coordinates directly and `city` is the display name. For example: `city=Hirayu%20Onsen&country=JP&lat=36.19061&lon=137.55175&snow=true&date=2026-11-18`.
- `start`: optional first travel date, `YYYY-MM-DD`.
- `end`: optional last travel date; defaults to `start`.
- `date`: optional shorthand for a single-day visit.
- `from` / `to`: aliases for `start` / `end`.
- `foliage`: only the exact value `true` enables the foliage section. Requires valid travel dates.
- `snow`: only the exact value `true` enables snow history. Requires valid travel dates.

Takao in Kyoto, with foliage:

https://sergio-marani.github.io/notion-widgets/weather/?place=takao-kyoto&date=2026-11-18&foliage=true

Takayama, with snowfall history:

https://sergio-marani.github.io/notion-widgets/weather/?place=takayama&start=2026-11-15&end=2026-11-19&snow=true

A location outside the catalog:

https://sergio-marani.github.io/notion-widgets/weather/?city=Milano&country=IT

Either `place` or `city` is required. Unknown IDs, unavailable catalogs or invalid catalog coordinates show an error; an explicit `place` never falls back to a similarly named city. With `city`, the geocoding provider chooses the location using the existing exact-name/first-result behavior, so use `place` when the intended district matters. `city=Takao` does not imply Takao in Kyoto, even with `country=JP`.

## Place catalog

Names, countries and coordinates are defined once in `data/places/data.json`. The catalog currently provides:

| ID | Place |
| --- | --- |
| `osaka` | Osaka |
| `kyoto` | Kyoto |
| `takao-kyoto` | Takao (Kyoto) |
| `takayama` | Takayama |
| `hirayu-onsen` | Hirayu Onsen |
| `kanazawa` | Kanazawa |
| `nikko` | Nikko |
| `tokyo` | Tokyo |

Catalog format (`schemaVersion: 1`):

```json
{
  "$schema": "./schema.json",
  "schemaVersion": 1,
  "places": {
    "takao-kyoto": {
      "countryCode": "JP",
      "placeName": "Takao (Kyoto)",
      "placeLocalName": "高雄",
      "sourceUrl": "https://weathernews.jp/koyo/spot/26204/",
      "latitude": 35.054823,
      "longitude": 135.673874
    }
  }
}
```

Coordinates are WGS84 decimal degrees. Every place requires a country, names, coordinate source URL, latitude and longitude. IDs are lowercase letters/numbers separated by hyphens; treat them as stable references. Takao's coordinates use the map linked from [Weathernews's Takao page](https://weathernews.jp/koyo/spot/26204/), not another city or Kyoto's city center. Other current entries use the specific Japanese result verified in Open-Meteo geocoding; their source URLs are recorded individually.

Optional `geocodingId` stores the provider's numeric location ID. It lets a `city` search link to the same foliage record only when the provider ID and country both match. Matching by a broad name alone is deliberately avoided. Takao has no geocoding ID because the catalog uses its explicit local map coordinates.

Weather, historical temperatures and snow history all use the selected location's coordinates. Catalog local names are displayed even without foliage or travel dates. The catalog is loaded independently from seasonal data, so a foliage loading error does not prevent weather for a catalog place.

## Weather, history and layout

Current weather includes condition, temperature, feels-like temperature and humidity. It refreshes approximately every 30 minutes while the page is visible. With dates, history shows the mean daily high and mean daily low for the same calendar dates in the previous year. February 29 maps to February 28 when necessary. These values provide historical context, not a trip forecast.

Without dates, historical and optional seasonal sections are hidden. Invalid or reversed dates and intervals longer than 366 days show an error. Each section loads independently without blocking current weather rendering.

At viewport widths of 340 px or less, the weather icon sits above the temperature. Dividers and spacing appear only between adjacent visible `widget-section` blocks, never after the final section.

## Optional foliage

Foliage requires `foliage=true`, valid dates, a catalog-linked location and overlap with a recorded tree season. A direct `place` selection uses its catalog ID. A `city` result can use foliage only when its provider ID and country match an entry with a `geocodingId`.

Explicit `lat`/`lon` can also link to foliage when `country` matches and the coordinates match exactly one catalog location within 0.0001 degrees per axis (roughly 11 m latitude). A display name alone never links a distant or ambiguous coordinate point to foliage.

`data/foliage/data.json` uses the same place IDs as the catalog. It contains sources, optional notes and tree intervals, without repeating names, countries or coordinates. Format (`schemaVersion: 2`):

```json
{
  "$schema": "./schema.json",
  "schemaVersion": 2,
  "updated": "2026-10-01",
  "places": {
    "takao-kyoto": {
      "sourceUrl": "https://weathernews.jp/koyo/spot/26204/",
      "trees": [
        {
          "name": "Maple",
          "color": "red",
          "start": "2026-11-08",
          "peak": "2026-11-23",
          "end": "2026-12-05"
        }
      ]
    }
  }
}
```

The dates above are existing dataset estimates, not forecasts newly researched during the catalog migration. Existing sources, dates and tree lists have been preserved.

- `updated`: actual revision date of the seasonal estimates.
- Each foliage entry needs its own HTTPS `sourceUrl` and a non-empty `trees` array. There is no default source. Optional `notes` describe source context and uncertainty; they are not displayed.
- Tree `name` is a free display label. `color` selects one of three fixed CSS gradients: `yellow`, `orange`, `red`. Adding Larice, Faggio or other trees requires only JSON edits.
- Tree dates must be real ISO dates including the year, ordered `start <= peak <= end` and `start < end`.
- A tree bar is visible when `visit.start <= tree.end` and `visit.end >= tree.start`. Trees are evaluated independently, in JSON order. When foliage is enabled, keep the small `🍁 Foliage` section visible before and after the season, explaining that foliage has not started or has ended for the selected dates. Gaps between tree seasons, unsupported years and missing location data have separate messages; they never create empty bars.
- The white marker shows the midpoint of the visit, clamped to the tree's start/end interval. The date on the right is the estimated peak.

To add a location, first add its metadata and verified coordinates to the place catalog, then add seasonal estimates under the exact same ID in the foliage file. To revise forecasts, supply both schemas to the research model, request traceable sources and uncertainty notes, and distinguish sourced forecasts from inferred estimates. Omit unsupported trees instead of inventing dates. Data is not automatically refreshed.

## Optional snow history

Enable `snow=true` with valid dates; combine with `foliage=true` if desired. Snow works for catalog places, `city` searches outside the catalog and explicit `lat`/`lon`, and uses no static seasonal JSON.

The section independently loads a current forecast and daily `snowfall_sum` in centimeters from the [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api) for the same interval three, two and one years before the trip. Year tiles run oldest to newest from left to right. Cross-year visits retain both years; February 29 maps to February 28 when necessary.

### Current forecast and header percentage

The [Forecast API](https://open-meteo.com/en/docs) is requested with up to 16 forecast days, then filtered to the exact travel interval. It must cover every requested day with valid snowfall data to be considered complete. A partial period is labelled with the number of covered days; it never becomes a complete dry forecast.

- Complete forecast without any day reaching 0.1 cm: show “Non è ancora prevista neve per le tue date” and 0% in the header, taking precedence over historical snowfall.
- Complete forecast with snow: show the total forecast cm. Request [ECMWF IFS ensemble snowfall](https://open-meteo.com/en/docs/ensemble-api) and estimate the chance of any snowy day as the fraction of complete ensemble members with at least one day reaching 0.1 cm. At least two complete members are required. This is an ensemble estimate for the whole interval, not precipitation probability (which also includes rain).
- If forecast snow is positive but the ensemble is missing, incomplete or entirely disagrees, show the snowfall amount and `—` for the percentage rather than an invented value or a contradictory historical 0%.
- Outside the available forecast horizon, show “Il meteo per le tue date non è disponibile” and retain historical frequency when available, explicitly labelled “Stima storica, non previsione”. With no historical samples, show `—`.
- Partial forecasts show their actual coverage. Any positive snowfall within the covered days is shown as an “at least” amount, without assigning a whole-period percentage. A partial dry period never forces the percentage to 0%.

The requested dry-forecast 0% is an indicator of the current forecast scenario, not a guarantee that snowfall is impossible. Forecast/ensemble data and the small historical sample are separate estimates, not pooled into one probability. Forecast data can update the header without waiting for history, and vice versa.

A year is usable only with a complete, consecutive daily series of finite non-negative values in cm. Missing days, failed requests and incompatible units exclude the whole year. Periods ending today (UTC) or later are also excluded. Other available years remain usable; no older replacement years are requested.

- Snowy day: at least 0.1 cm of snowfall.
- Snowy year: at least one snowy day in that comparison period.
- Historical frequency: snowy years / complete available years, rounded to a whole percent. Two snowy years out of three gives 67%. With only one year, the value is 0% or 100%.
- Mean cm: average total snowfall over the whole comparison period, including zero-snow years. It is not snow depth on the ground.
- Under “Negli anni precedenti:”, three year tiles show total cm or `n/d`, followed by historical snowy years/available years. No complete history produces an unavailable message; an available current forecast still works.

One to three historical years are a small descriptive sample, not a calibrated forecast probability. Archive reanalysis, forecast model resolution and grid-cell elevation may differ from local mountain conditions. The compact snowflake/current forecast/year tiles distinguish snow from foliage gradients.

## Files and preview

Every widget has `index.html` and `README.md`, uses local `style.css` rather than inline style blocks or `widget.css`, and initializes in `scripts/widget.js`. Dynamic values such as the visit marker position may use inline style attributes.

- `scripts/weather-core.js`: settings, place catalog, geocoding, current/historical weather and card rendering.
- `scripts/widget.js`: composes optional sections from URL flags.
- `scripts/sections/foliage.js`: ID-based seasonal data lookup and tree bars.
- `scripts/sections/snow.js`: snow archive requests, statistics and compact rendering.
- `data/places/data.json`, `data/places/schema.json`: shared location metadata and contract.
- `data/foliage/data.json`, `data/foliage/schema.json`: seasonal estimates and contract.

Serve the repository root with `python -m http.server 8000`, then open `/weather/?place=takao-kyoto&date=2026-11-18&foliage=true`. Deploy the entire `weather/` directory. Modules and JSON loading require HTTP rather than `file://`.

## Sources

- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- Individual catalog/foliage source URLs, including [Weathernews](https://weathernews.jp/koyo/) and [Japan Meteorological Corporation](https://n-kishou.com/corp/news-contents/autumn/?lang=en).
