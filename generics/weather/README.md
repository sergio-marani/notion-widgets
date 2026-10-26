# Weather Widget

A single-city weather card for Notion embeds, with optional historical temperature context. Interface labels are in Italian. No build step is required.

## Usage

https://sergio-marani.github.io/notion-widgets/generics/weather/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19

## URL parameters

- `city` (required): city name, e.g. `Kyoto`, `Milano` or `Paris`.
- `country` (optional): two-letter ISO country code, e.g. `JP`; recommended for ambiguous names.
- `start` (optional): first travel date in `YYYY-MM-DD` format.
- `end` (optional): last travel date; defaults to `start` for a single day.
- `date` (optional): shorthand for a single-day visit.
- `from` / `to`: aliases for `start` / `end`.

Without dates, only current weather is shown. With dates, the historical section shows the mean daily high and mean daily low for the same calendar dates in the previous year. February 29 maps to February 28 when needed. These are historical values, not travel forecasts. Invalid or reversed dates and intervals longer than 366 days display an error.

Current weather includes condition, temperature, feels-like temperature and humidity. It refreshes approximately every 30 minutes while the page is visible. Unavailable current or historical weather is reported independently.

## Files and dependencies

Every widget must have `index.html` and `README.md`, use local `style.css` when styling is needed, and put initialization in `widget.js`. Additional reusable modules and data files are allowed.

- `index.html`: entry page; loads `style.css` and the `widget.js` module.
- `style.css`: shared card layout, responsive rules and light/dark theme support.
- `widget.js`: mounts the weather card.
- `weather-core.js`: shared URL parsing, geocoding, API requests and rendering. Also used by [Japan foliage](../../customs/japan-foliage/README.md).

Serve the repository root over HTTP, for example with `python -m http.server 8000`, then open `/generics/weather/?city=Kyoto`. Deploy the full repository to preserve shared dependencies.

## Sources

- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
