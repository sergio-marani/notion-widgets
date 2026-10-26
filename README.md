# Notion Widgets

Lightweight widgets for Notion embeds, hosted on GitHub Pages. Currently one widget: [Weather](./weather/README.md), with optional historical temperatures, foliage and snow history.

## Structure

```text
weather/
  index.html
  style.css
  README.md
  scripts/
    widget.js            # URL-driven initialization
    weather-core.js      # Weather and historical temperature logic
    sections/
      foliage.js         # Optional seasonal section
      snow.js            # Optional three-year snowfall history
  data/
    foliage/
      data.json          # Editable estimates for supported places
      schema.json        # Dataset contract
tests/
  weather.test.mjs
  snow.test.mjs
```

## Usage

Current weather:

https://sergio-marani.github.io/notion-widgets/weather/?city=Milano&country=IT

Weather and historical temperatures:

https://sergio-marani.github.io/notion-widgets/weather/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19

Weather, historical temperatures and eligible foliage:

https://sergio-marani.github.io/notion-widgets/weather/?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19&foliage=true

Foliage is opt-in. It appears only for a city in the dataset, matched by place name and country when travel dates overlap a recorded tree season. Unsupported cities, years and out-of-season visits show weather/history without foliage. Missing dates also hide foliage. See the [widget README](./weather/README.md) for the complete contract.

Snow history is opt-in with `snow=true` and requires travel dates:

https://sergio-marani.github.io/notion-widgets/weather/?city=Takayama&country=JP&start=2026-01-10&end=2026-01-12&snow=true

It compares the same dates in the three previous years, falling back to two or one complete years. The percentage is the historical frequency of periods with at least one snowy day, not a weather forecast. The compact section shows average snowfall in cm and individual year totals. Snow and foliage can be enabled together.

## Widget conventions

Each widget belongs in its own root directory and must provide `index.html` and `README.md`. When CSS is needed, use local `style.css` linked from `index.html`, not `widget.css` or inline style blocks. Initialize in `scripts/widget.js`; keep shared logic in `scripts/`, optional sections in `scripts/sections/`, and each section's JSON data and schema in `data/<section>/`. Dynamic per-element values such as the visit marker position may use inline style attributes.

There is one weather entry page. Optional sections extend its existing card; they do not duplicate weather or history rendering. Snow data comes from the archive API, so it needs no static JSON folder. There are no separate generic/custom categories.

## Preview, checks and hosting

Serve the repository root with `python -m http.server 8000`, then open `http://localhost:8000/weather/?city=Kyoto&country=JP&date=2026-11-15&foliage=true`. JavaScript modules and JSON loading require HTTP; do not open HTML through `file://`.

Run checks with Node.js 22.22 or newer: `node --test tests/weather.test.mjs tests/snow.test.mjs`. No package installation or build step is required.

For GitHub Pages, publish the `main` branch from the repository root.

## Existing embeds

The old `generics/weather/`, `customs/japan-foliage/` and legacy combined widget paths have been removed. Update Notion embeds manually to `/weather/`, preserving city/date parameters. Add `foliage=true` to enable foliage.
