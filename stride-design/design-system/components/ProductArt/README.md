# ProductArt

Illustrated product image (SVG) used wherever a product photo will go — cards, gallery, cart rows, order summaries — until real photos land in `/public`.

- Kinds: `shoe`, `tee`, `longsleeve`, `jacket`, `shorts`, `cap`, `socks`, `vest`, `belt`.
- `color` / `accent` are the product's own colours (product data, not theme tokens). `bg` picks the image well: `stone` (default), `volt`, or `ink`.
- Keep grids on `stone` (the big-store look); use `volt` or `ink` wells for feature tiles and campaign blocks.
- `view` gives gallery variety from one drawing: `full`, `zoom` (detail), `angle`, `back` (mirrored).
- Fills its box at 4:5 (`preserveAspectRatio` slice). Hover zoom comes from the card.
- When real photos exist, pass `image` to `ProductCard` / `CartItem` instead; same well colours behind transparent PNGs.

Decorative inside a card (the name is the label); pass `label` when it stands alone.
