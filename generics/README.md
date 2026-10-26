# Generic Widgets

Reusable widgets for different Notion pages. Each widget belongs in its own English-named directory.

## Structure conventions

Each widget must provide `index.html` and `README.md`. When CSS is needed, put it in a local `style.css` linked from `index.html`; do not use `widget.css` or inline style blocks. Put widget initialization in `widget.js`. Additional JavaScript modules and data files are allowed when needed.

Reuse existing modules and styles instead of duplicating them. A widget that extends another widget can import its styles from its own `style.css`.

## Widgets

- [Weather](./weather/): current weather and previous-year temperatures for one city.
