# ProductCard

The tile in every product grid: home, catalog, wishlist.

Anatomy: 4:5 image on `surface-alt` (no radius) → badge top-left (*New* or *Out of stock*) → wishlist heart top-right → beginner guidance tag → name (`title`, 2 lines max) → category · run type → price.

- Image and text are one link to the product page; the heart is a separate button beside it.
- `tag`: plain-language guidance (*Good for your first 5K*, *Great for trails*). Max one per card.
- `soldOut`: every size is gone — the card shows *Out of stock* and dims the image but stays clickable (the product page stays browsable).
- No colour swatches in v1 (colour variants are out of scope).
- Images: product on a plain light-grey studio background, consistent crop across the grid. Without `image`, a placeholder word shows — handy while building.
- Grid: 2 columns on mobile, 3 from `bp-md`, 4 from `bp-lg`, `space-6` gap.
