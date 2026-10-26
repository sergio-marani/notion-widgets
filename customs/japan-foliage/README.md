# Japan Foliage Widget

The [generic weather card](../../generics/weather/README.md) extended with ginkgo and maple foliage estimates for one city at a time. Interface labels are in Italian. No build step is required.

## Usage

https://sergio-marani.github.io/notion-widgets/customs/japan-foliage/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19

Use one Notion embed per city. This replaces the removed legacy six-city combined widget; existing Notion embeds must be updated manually.

## URL parameters

- `city` (required): city name.
- `country` (optional): two-letter ISO country code; use `JP` for Japanese cities.
- `start` (optional): first travel date in `YYYY-MM-DD` format.
- `end` (optional): last travel date; defaults to `start`.
- `date` (optional): shorthand for a single-day visit.
- `from` / `to`: aliases for `start` / `end`.

Weather and historical temperatures behave as described in the generic widget README. Foliage requires a resolved Japanese city in the dataset and travel dates whose start year matches both peak dates. Missing records, missing dates, unsupported years or JSON loading errors show a foliage status message; weather continues to work.

## Files and dependencies

Every widget must have `index.html` and `README.md`, use local `style.css` when styling is needed, and put initialization in `widget.js`. Additional reusable modules and data files are allowed.

- `index.html`: entry page; loads local `style.css` and the `widget.js` module.
- `style.css`: imports `../../generics/weather/style.css` and adds foliage styles.
- `widget.js`: loads the foliage dataset and extends `../../generics/weather/weather-core.js` with Japanese labels and foliage bars.
- `foliage.json`: editable seasonal data and source links.

Serve the repository root over HTTP, for example with `python -m http.server 8000`, then open `/customs/japan-foliage/?city=Kyoto&country=JP&date=2026-11-15`. Deploy the full repository, including `generics/weather/`, to preserve imports.

## Dataset maintenance

Current records cover Osaka, Kyoto, Takayama, Kanazawa, Nikkō and Tokyo for 2026. These are static reference estimates, not live foliage measurements or automatically refreshed forecasts.

To update the season, edit `foliage.json`:

- `updated`: dataset update date.
- `defaultSource`: fallback HTTPS source URL.
- `cities`: records keyed by a stable city identifier.
- Each record: `name`, optional `aliases`, Japanese label `jp`, `ginkgoPeak` and `maplePeak` as `YYYY-MM-DD` dates.
- Optional `ginkgoFallen` / `mapleFallen`: end-of-season overrides; optional `sourceUrl`: city-specific HTTPS source.

The white marker represents the midpoint of the selected visit, clamped to the bar. Ginkgo bars run from 10 days before peak to 10 days after peak; maple bars run from 12 days before peak to 8 days after peak, unless a fallen-date override is supplied. The displayed date is the estimated peak.

## Sources

Weather uses the Open-Meteo APIs documented in the [weather README](../../generics/weather/README.md).

- [Japan Meteorological Corporation](https://n-kishou.com/corp/news-contents/autumn/?lang=en)
- [Weathernews](https://weathernews.jp/koyo/)
