# Notion Widgets

A collection of lightweight, self-hosted widgets designed for Notion embeds and served with GitHub Pages.

## Structure

- `generic/` — reusable widgets for multiple Notion pages.
- `custom/` — page-specific or project-specific widgets.
- `custom/japan-weather-foliage/` — Japan trip weather and autumn foliage dashboard.

## Embedding

Once GitHub Pages is enabled from `main` / `(root)`, widgets can be embedded using their folder URL.

**Japan weather and foliage:**
`https://sergio-marani.github.io/notion-widgets/custom/japan-weather-foliage/`

The widget uses Open-Meteo for current and forecast weather and historical 2025 temperatures. Autumn foliage forecasts are dated snapshots from the linked forecast sources and are **not** automatically updated. It is a transparent, compact, six-card sidebar widget.

## Sources

- [Open-Meteo forecast](https://open-meteo.com/)
- [Japan Meteorological Corporation's 2026 autumn foliage forecast](https://n-kishou.com/corp/news-contents/autumn/?lang=en)
- [Weathernews autumn foliage](https://weathernews.jp/koyo/)
