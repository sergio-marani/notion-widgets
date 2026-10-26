# Custom Widgets

Widgets built for particular pages or projects.

## Structure conventions

Each widget must provide `index.html` and `README.md`. When CSS is needed, put it in a local `style.css` linked from `index.html`; do not use `widget.css` or inline style blocks. Put widget initialization in `widget.js`. Additional JavaScript modules and data files are allowed when needed.

Reuse generic widget modules and styles instead of copying them. An extension can import generic styles from its own `style.css` and add its specific rules there.

## Widgets

- [Japan foliage](./japan-foliage/): the generic weather card extended with seasonal foliage estimates for one city.
