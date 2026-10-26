# Notion Widgets

Lightweight widgets for Notion embeds, hosted using GitHub Pages. Weather functionality is shared between the generic and Japan-specific widget.

## Structure

```text
generics/
  README.md
  weather/
    index.html        # Reusable weather + historical temperature card
    style.css         # Shared weather card styling
    widget.js         # Weather initialization
    weather-core.js   # Shared geocoding, weather, historical averages and UI
    README.md         # Usage and URL parameters
customs/
  README.md
  japan-foliage/
    index.html        # Generic weather extended with Japan foliage
    style.css         # Imports weather styles and adds foliage styling
    widget.js         # Weather initialization with foliage extension
    foliage.json      # City-specific foliage dates and sources (editable data)
    README.md         # Usage and dataset maintenance
```

## Widget conventions

Every widget must have an `index.html` entry page and a `README.md` describing usage, URL parameters, dependencies and data sources. When styling is needed, use a local `style.css` linked from `index.html`, not `widget.css` or inline style blocks. Put initialization in `widget.js`; keep reusable logic in additional modules and editable data in separate files as needed.

Extensions should reuse existing modules and import shared styles through their own `style.css`. Keep extension-specific rules in the extension directory.

- [Generic widgets](./generics/README.md) · [Weather](./generics/weather/README.md)
- [Custom widgets](./customs/README.md) · [Japan foliage](./customs/japan-foliage/README.md)

## Local preview and hosting

Serve the repository root over HTTP (for example, `python -m http.server 8000`) and open a widget URL with its query parameters. Opening `index.html` through `file://` does not reliably support JavaScript modules and JSON loading. No build step is required.

For GitHub Pages, publish the `main` branch from the repository root. Deploy the entire repository so the custom widget can load the shared weather assets.

## URL parameters (both widgets)

- `city` **required**: a location that can be resolved by Open-Meteo geocoding, e.g. `Kyoto`, `Milano`, `Paris`.
- `country` **optional**: two-letter ISO country code (`JP`, `IT`, `FR`); recommended if city names are ambiguous.
- `start` **optional**: first travel date in `YYYY-MM-DD` format.
- `end` **optional**: last travel date in `YYYY-MM-DD` format. Omit for a single-day trip.
- `date` **optional** alternative for one single-day visit. Aliases `from` / `to` are also supported.

The current weather appears for the selected city, including condition icon, temperature, feels-like temperature and humidity.

When travel dates are supplied, the widget also displays **historical temperatures for the same calendar dates in the previous year** (e.g. 15–19 November 2026 => 15–19 November 2025). The two figures are the **mean of daily maximum temperatures** and **mean of daily minimum temperatures** over the selected period; they are historical observations/reanalysis, not forecasts for the trip. Historical data is sourced from the Open-Meteo Archive API. If dates are omitted, the historical section is hidden. Current weather refreshes approximately every 30 minutes while the page is visible.

## Generic weather

Embed one generic weather widget per desired city:

**Kyoto · November 15–19, 2026**

https://sergio-marani.github.io/notion-widgets/generics/weather/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19

**Milan · single date**

https://sergio-marani.github.io/notion-widgets/generics/weather/?city=Milano&country=IT&date=2026-11-15

**Weather without historical date period**

https://sergio-marani.github.io/notion-widgets/generics/weather/?city=Tokyo

## Japan foliage extension

This is the **same complete weather card**, with an extra foliage section for ginkgo and maple. It takes the **same city/date URL parameters** and displays **one city at a time**.

**Kyoto · November 15–19, 2026**

https://sergio-marani.github.io/notion-widgets/customs/japan-foliage/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19

**Tokyo · November 25–30, 2026**

https://sergio-marani.github.io/notion-widgets/customs/japan-foliage/?city=Tokyo&country=JP&start=2026-11-25&end=2026-11-30

**A city with weather but no foliage dataset**

https://sergio-marani.github.io/notion-widgets/customs/japan-foliage/?city=Milano&country=IT&start=2026-11-15&end=2026-11-19

### Foliage data

The city-specific foliage values **are not hard-coded into the HTML**. Edit `customs/japan-foliage/foliage.json` to update/add locations. Current records: Osaka, Kyoto, Takayama, Kanazawa, Nikkō and Tokyo.

For an eligible Japanese city and 2026 travel dates, the extension reads the matching record from JSON, computes the mid-visit date from the URL, and displays two colored gradient bars with a white visit marker and an estimated peak date. The dataset stores peak dates, optional end-of-season overrides, Japanese city labels and source URLs. The widget reports missing foliage data for cities not in JSON, unsupported years or dates not provided; weather continues to work normally.

Foliage dates are **static reference estimates**, not fetched or refreshed from an official foliage API. References link to Japan Meteorological Corporation (JMC) and Weathernews. To use a newer season, update the JSON with that year's data.

## Removed legacy widget

The former six-city combined widget has been removed. Existing Notion embeds using its old URL must be replaced manually with a `customs/japan-foliage/` URL containing the desired city and dates. Use one embed per city.

## Sources

- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- [Japan Meteorological Corporation foliage forecast](https://n-kishou.com/corp/news-contents/autumn/?lang=en)
- [Weathernews autumn foliage](https://weathernews.jp/koyo/)
