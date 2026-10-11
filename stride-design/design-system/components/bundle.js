/* @ds-bundle: {"format":4,"namespace":"Stride","components":[{"name":"Button"},{"name":"Badge"},{"name":"Price"},{"name":"Input"},{"name":"SizePicker"},{"name":"QuantityStepper"},{"name":"WishlistButton"},{"name":"ProductArt"},{"name":"ProductCard"},{"name":"CartItem"},{"name":"Header"}]} */
(function () {
  var React = window.React, h = React.createElement;

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }
  function money(v, cur) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(v); }
    catch (e) { return '$' + Number(v).toFixed(2); }
  }
  function useControlled(value, initial, onChange) {
    var s = React.useState(initial), inner = s[0], setInner = s[1];
    var isCtl = value !== undefined;
    return [isCtl ? value : inner, function (v) { if (!isCtl) setInner(v); if (onChange) onChange(v); }];
  }
  function Icon(d) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      d.map(function (p, i) { return h('path', { key: i, d: p }); }));
  }
  var ICONS = {
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
    user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 4-6 8-6s8 2 8 6'],
    bag: ['M5 8h14l-1 13H6L5 8z', 'M9 8V6a3 3 0 0 1 6 0v2'],
    menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    check: ['M5 12l5 5L20 7'],
    heart: ['M12 20s-7.5-4.6-9.3-9.2C1.6 7.8 3.6 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.4 3.3 4.3 6.3C19.5 15.4 12 20 12 20z']
  };

  /* ---- ProductArt: illustrated product image used until real photos exist ---- */
  var ART_BG = { stone: 'var(--surface-alt)', volt: 'var(--volt-soft)', ink: 'var(--surface-inverse)', sand: 'var(--surface-alt)', cobalt: 'var(--surface-alt)', red: 'var(--volt-soft)' };
  function P(d, fill, extra) { return h('path', Object.assign({ d: d, fill: fill }, extra || {})); }
  function S(d, stroke, w) { return h('path', { d: d, fill: 'none', stroke: stroke, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' }); }
  var SHADE = 'rgba(0,0,0,0.14)';
  var DRAW = {
    shoe: function (c, a, d, s) { return [
      P('M58 352 Q60 374 92 376 L318 376 Q350 374 352 352 Z', d),
      P('M54 330 L352 330 Q358 346 352 356 L58 358 Q48 346 54 330 Z', s),
      P('M64 332 C60 286 78 252 118 240 L176 226 C200 220 214 206 222 188 L250 180 C266 214 296 246 336 274 C356 288 360 312 350 332 Z', c),
      P('M300 252 C322 270 346 284 352 306 L350 332 L318 332 C318 300 310 276 300 252 Z', SHADE),
      P('M64 332 C60 290 70 258 96 244 L112 262 C96 282 94 308 98 332 Z', a),
      h('polygon', { points: '170,322 192,322 238,234 216,234', fill: a }),
      S('M112 244 C140 236 170 232 198 220', d, 5),
      S('M234 200 L254 212 M248 216 L268 228 M262 232 L282 244', d, 6),
      P('M82 238 L100 230 L110 252 L92 258 Z', a)
    ]; },
    tee: function (c, a, d) { return [
      P('M150 120 C165 142 235 142 250 120 L332 154 L306 224 L276 212 L280 398 L120 398 L124 212 L94 224 L68 154 Z', c),
      S('M152 122 C167 144 233 144 248 122', a, 9),
      P('M94 224 L68 154 L80 149 L104 218 Z', SHADE), P('M306 224 L332 154 L320 149 L296 218 Z', SHADE),
      h('polygon', { points: '230,190 246,190 232,228 216,228', fill: a }),
      S('M126 382 L276 382', SHADE, 4)
    ]; },
    longsleeve: function (c, a, d) { return [
      P('M150 112 C165 134 235 134 250 112 L322 140 L372 360 L338 372 L292 204 L290 398 L110 398 L108 204 L62 372 L28 360 L78 140 Z', c),
      S('M152 114 C167 136 233 136 248 114', a, 9),
      S('M34 352 L62 362 M366 352 L338 362', a, 12),
      h('polygon', { points: '230,186 246,186 232,224 216,224', fill: a }),
      S('M112 380 L288 380', SHADE, 4)
    ]; },
    jacket: function (c, a, d) { return [
      P('M150 112 C150 64 250 64 250 112 Z', c), P('M162 112 C162 82 238 82 238 112 Z', SHADE),
      P('M150 112 L250 112 L322 140 L372 360 L338 372 L292 204 L290 398 L110 398 L108 204 L62 372 L28 360 L78 140 Z', c),
      S('M200 116 L200 396', d, 5),
      S('M132 300 L170 296 M268 296 L230 300', SHADE, 5),
      S('M34 352 L62 362 M366 352 L338 362', a, 12),
      h('polygon', { points: '246,170 260,170 248,204 234,204', fill: a })
    ]; },
    shorts: function (c, a, d) { return [
      P('M100 170 L300 170 L318 352 L218 364 L200 262 L182 364 L82 352 Z', c),
      P('M100 170 L300 170 L303 198 L97 198 Z', a),
      S('M190 206 L196 222 M210 206 L204 222', d, 4),
      h('polygon', { points: '112,300 126,300 116,334 102,334', fill: a }),
      P('M200 262 L218 364 L208 365 L200 290 Z', SHADE)
    ]; },
    cap: function (c, a, d) { return [
      P('M96 296 C96 206 156 164 218 164 C290 164 322 222 322 296 Z', c),
      P('M300 286 C344 284 382 292 394 310 C362 322 320 316 294 308 Z', a),
      S('M218 166 C208 206 204 254 206 294', SHADE, 4),
      h('circle', { cx: 218, cy: 164, r: 9, fill: d }),
      h('polygon', { points: '170,236 184,236 174,262 160,262', fill: a }),
      S('M100 290 L318 290', SHADE, 6)
    ]; },
    socks: function (c, a, d) {
      var sock = function (dx, dy) { return [
        P('M' + (130 + dx) + ' ' + (120 + dy) + ' l60 0 l0 180 c0 30 20 40 50 52 c28 10 30 46 -4 48 l-66 -4 c-30 -2 -40 -16 -40 -46 Z', c),
        P('M' + (130 + dx) + ' ' + (120 + dy) + ' l60 0 l0 30 l-60 0 Z', a),
        P('M' + (226 + dx) + ' ' + (352 + dy) + ' c22 8 26 40 -4 44 l-20 -2 c10 -14 14 -30 24 -42 Z', a)
      ]; };
      return [h('g', { opacity: 0.85 }, sock(70, -24)), h('g', null, sock(0, 0))];
    },
    vest: function (c, a, d) { return [
      P('M136 128 L170 118 C180 162 220 162 230 118 L264 128 L294 204 L292 384 L108 384 L106 204 Z', c),
      h('rect', { x: 126, y: 216, width: 44, height: 96, rx: 14, fill: a }),
      h('rect', { x: 230, y: 216, width: 44, height: 96, rx: 14, fill: a }),
      h('rect', { x: 138, y: 204, width: 20, height: 16, rx: 4, fill: d }),
      h('rect', { x: 242, y: 204, width: 20, height: 16, rx: 4, fill: d }),
      S('M116 330 L284 330 M116 352 L284 352', d, 5)
    ]; },
    belt: function (c, a, d) { return [
      h('rect', { x: 36, y: 232, width: 328, height: 46, rx: 23, fill: c }),
      h('rect', { x: 66, y: 214, width: 24, height: 80, rx: 7, fill: a }),
      h('rect', { x: 104, y: 214, width: 24, height: 80, rx: 7, fill: a }),
      h('rect', { x: 272, y: 214, width: 24, height: 80, rx: 7, fill: a }),
      h('rect', { x: 310, y: 214, width: 24, height: 80, rx: 7, fill: a }),
      h('rect', { x: 178, y: 222, width: 44, height: 66, rx: 9, fill: d }),
      h('circle', { cx: 150, cy: 255, r: 7, fill: d }), h('circle', { cx: 250, cy: 255, r: 7, fill: d })
    ]; }
  };
  var VIEW = { full: 'translate(200 270) scale(1.12) translate(-200 -270)', zoom: 'translate(200 250) scale(1.75) translate(-236 -270)', angle: 'rotate(-12 200 270) translate(0 -14)', back: 'translate(400 0) scale(-1 1)' };
  function ProductArt(p) {
    var draw = DRAW[p.kind] || DRAW.shoe;
    var bg = ART_BG[p.bg] || p.bg || ART_BG.stone;
    var t = VIEW[p.view || 'full'];
    return h('svg', { className: cx('st-art', p.className), viewBox: '0 0 400 500', preserveAspectRatio: 'xMidYMid slice', role: p.label ? 'img' : undefined, 'aria-label': p.label, 'aria-hidden': p.label ? undefined : true },
      h('rect', { width: 400, height: 500, fill: bg }),
      p.view === 'zoom' ? null : h('ellipse', { cx: 200, cy: 404, rx: 150, ry: 13, fill: 'rgba(0,0,0,0.12)' }),
      h('g', { transform: t || undefined }, draw(p.color || '#0e0f0c', p.accent || '#d4ff3a', p.detail || '#0e0f0c', p.sole || '#f5f5f0')));
  }

  var ARROW = ['M5 12h14', 'M13 6l6 6-6 6'];
  function Button(p) {
    var rest = omit(p, ['variant', 'size', 'fullWidth', 'className', 'children', 'arrow']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('st-btn', 'st-btn--' + (p.variant || 'primary'), 'st-btn--' + (p.size || 'md'), p.fullWidth && 'st-btn--full', p.className)
    }), p.children, p.arrow ? Icon(ARROW) : null);
  }

  function Badge(p) {
    return h('span', { className: cx('st-badge', p.tone && p.tone !== 'neutral' && 'st-badge--' + p.tone, p.className) }, p.children);
  }

  function Price(p) {
    var onSale = p.compareAt != null && p.compareAt > p.amount;
    var pct = onSale ? Math.round((1 - p.amount / p.compareAt) * 100) : 0;
    return h('span', { className: cx('st-price', 'st-price--' + (p.size || 'md'), p.className) },
      h('span', { className: cx('st-price__now', onSale && 'st-price__now--sale') }, money(p.amount, p.currency)),
      onSale ? h('s', { className: 'st-price__was', 'aria-label': 'Was ' + money(p.compareAt, p.currency) }, money(p.compareAt, p.currency)) : null,
      onSale && p.showPercent !== false ? h('span', { className: 'st-price__off' }, '-' + pct + '%') : null);
  }

  function Input(p) {
    var autoId = React.useId ? React.useId() : 'st-in';
    var id = p.id || autoId, msgId = id + '-msg';
    var msg = p.error || p.hint;
    var rest = omit(p, ['label', 'hint', 'error', 'className', 'id']);
    return h('div', { className: cx('st-input', p.error && 'st-input--error', p.className) },
      h('label', { htmlFor: id }, p.label),
      h('input', Object.assign({ id: id, 'aria-invalid': p.error ? true : undefined, 'aria-describedby': msg ? msgId : undefined }, rest)),
      msg ? h('p', { id: msgId, className: 'st-input__msg' }, p.error || p.hint) : null);
  }

  function SizePicker(p) {
    var st = useControlled(p.value, p.defaultValue || null, p.onChange), value = st[0], setValue = st[1];
    var sizes = (p.sizes || []).map(function (s) { return typeof s === 'string' ? { label: s, available: true } : s; });
    return h('fieldset', { className: cx('st-sizes', p.className) },
      h('legend', null, p.label || 'Select size', value ? h('span', null, value) : null),
      h('div', { className: 'st-sizes__grid', role: 'radiogroup' },
        sizes.map(function (s) {
          return h('button', {
            key: s.label, type: 'button', role: 'radio', className: 'st-chip',
            'aria-checked': value === s.label, disabled: s.available === false,
            'aria-label': s.available === false ? s.label + ', sold out' : s.label,
            onClick: function () { setValue(s.label); }
          }, s.label);
        })));
  }

  function QuantityStepper(p) {
    var min = p.min == null ? 1 : p.min, max = p.max == null ? 10 : p.max;
    var st = useControlled(p.value, p.defaultValue || min, p.onChange), v = st[0], set = st[1];
    return h('div', { className: cx('st-step', p.className), role: 'group', 'aria-label': p.label || 'Quantity' },
      h('button', { type: 'button', 'aria-label': 'Decrease', disabled: v <= min, onClick: function () { set(v - 1); } }, '−'),
      h('output', { 'aria-live': 'polite' }, v),
      h('button', { type: 'button', 'aria-label': 'Increase', disabled: v >= max, onClick: function () { set(v + 1); } }, '+'));
  }

  function WishlistButton(p) {
    var st = useControlled(p.active, !!p.defaultActive, p.onToggle), on = st[0], set = st[1];
    var full = p.variant === 'full';
    return h('button', {
      type: 'button', className: cx('st-heart', full && 'st-heart--full', on && 'st-heart--on', p.className),
      'aria-pressed': on, 'aria-label': full ? undefined : (on ? 'Remove from wishlist' : 'Add to wishlist'),
      onClick: function (e) { if (e && e.preventDefault) e.preventDefault(); set(!on); }
    }, Icon(ICONS.heart), full ? h('span', null, on ? 'Saved to wishlist' : 'Add to wishlist') : null);
  }

  function ProductCard(p) {
    var badge = p.soldOut ? { label: 'Out of stock', tone: 'neutral' }
      : p.badge ? (typeof p.badge === 'string' ? { label: p.badge, tone: 'new' } : p.badge) : null;
    return h('div', { className: cx('st-card', p.soldOut && 'st-card--soldout', p.className) },
      h('a', { className: 'st-card__link', href: p.href || '#' },
        h('div', { className: 'st-card__img' },
          p.image ? h('img', { src: p.image, alt: p.imageAlt || p.name, loading: 'lazy' })
            : p.art ? h(ProductArt, Object.assign({}, p.art))
            : h('div', { className: 'st-card__ph', 'aria-hidden': true }, p.placeholder || 'Stride'),
          badge ? h('span', { className: 'st-card__badge' }, h(Badge, { tone: badge.tone }, badge.label)) : null),
        h('div', { className: 'st-card__body' },
          p.tag ? h(Badge, { tone: 'guide' }, Icon(ICONS.check), p.tag) : null,
          h('h3', { className: 'st-card__name' }, p.name),
          p.category ? h('p', { className: 'st-card__meta' }, p.category + (p.colors && p.colors.length ? ' · ' + p.colors.length + (p.colors.length === 1 ? ' colour' : ' colours') : '')) : null,
          h(Price, { amount: p.price, compareAt: p.compareAt, currency: p.currency, size: 'sm' }),
          p.colors && p.colors.length ? h('div', { className: 'st-swatches', 'aria-hidden': true },
            p.colors.slice(0, 5).map(function (c, i) { return h('span', { key: i, className: 'st-swatch', style: { background: c } }); })) : null)),
      p.wishlist === false ? null : h('span', { className: 'st-card__heart' },
        h(WishlistButton, { active: p.wishlisted, defaultActive: p.defaultWishlisted, onToggle: p.onWishlist })));
  }

  function CartItem(p) {
    return h('div', { className: cx('st-cart', p.className) },
      p.image ? h('img', { className: 'st-cart__img', src: p.image, alt: '' })
        : h('div', { className: 'st-cart__img', 'aria-hidden': true }, p.art ? h(ProductArt, Object.assign({}, p.art)) : null),
      h('div', { className: 'st-cart__info' },
        h('h3', { className: 'st-cart__name' }, p.name),
        p.variant ? h('p', { className: 'st-cart__var' }, p.variant) : null,
        p.note ? h(Badge, { tone: p.noteTone || 'neutral' }, p.note) : null,
        h('div', { className: 'st-cart__actions' },
          h(QuantityStepper, { value: p.quantity, defaultValue: p.quantity || 1, max: p.max, onChange: p.onQuantityChange }),
          h('button', { type: 'button', className: 'st-link', onClick: p.onRemove }, 'Remove'))),
      h(Price, { amount: p.price * (p.quantity || 1), compareAt: p.compareAt ? p.compareAt * (p.quantity || 1) : undefined, currency: p.currency, showPercent: false }));
  }

  function Header(p) {
    var links = p.links || [{ label: 'Shoes', href: '#' }, { label: 'Apparel', href: '#' }, { label: 'Gear', href: '#' }];
    return h('header', { className: cx('st-header', p.className) },
      h('a', { className: 'st-skip', href: '#main' }, 'Skip to content'),
      p.promo ? h('div', { className: 'st-header__promo' }, p.promo) : null,
      p.utility ? h('nav', { className: 'st-header__utility', 'aria-label': 'Help and account' }, p.utility.map(function (u) { return h('a', { key: u.label, href: u.href || '#' }, u.label); })) : null,
      h('div', { className: 'st-header__bar' },
        h('button', { type: 'button', className: 'st-iconbtn st-mobile-only', 'aria-label': 'Menu', onClick: p.onMenu }, Icon(ICONS.menu)),
        h('a', { className: 'st-logo', href: p.homeHref || '#', 'aria-label': 'Stride home' }, 'Stride', h('i', { 'aria-hidden': true })),
        h('nav', { 'aria-label': 'Main' }, links.map(function (l) {
          return h('a', { key: l.label, href: l.href || '#', className: l.sale ? 'st-nav--sale' : undefined, 'aria-current': p.active === l.label ? 'page' : undefined }, l.label);
        })),
        p.searchHref ? h('form', { className: 'st-search', role: 'search', onSubmit: function (e) { e.preventDefault(); if (p.onSearch) p.onSearch(e.target.q.value); } },
          Icon(ICONS.search),
          h('input', { type: 'search', name: 'q', defaultValue: p.query, placeholder: p.searchPlaceholder || 'Search shoes, apparel, gear', 'aria-label': 'Search products' })) : null,
        h('div', { className: 'st-header__icons' },
          p.searchHref ? h('a', { className: 'st-iconbtn st-mobile-only', href: p.searchHref, 'aria-label': 'Search' }, Icon(ICONS.search)) : iconBtn(null, 'Search', p.onSearch, Icon(ICONS.search)),
          iconBtn(p.accountHref, p.accountName ? 'Account, signed in as ' + p.accountName : 'Account', p.onAccount, Icon(ICONS.user),
            p.accountName ? h('span', { className: 'st-signed', 'aria-hidden': true }) : null),
          p.wishlistHref || p.onWishlist ? iconBtn(p.wishlistHref, 'Wishlist' + (p.wishlistCount ? ', ' + p.wishlistCount + ' items' : ''), p.onWishlist, Icon(ICONS.heart)) : null,
          iconBtn(p.cartHref, 'Cart, ' + (p.cartCount || 0) + ' items', p.onCart,
            Icon(ICONS.bag), p.cartCount ? h('span', { className: 'st-count', 'aria-hidden': true }, p.cartCount) : null))));
  }
  function iconBtn(href, label, onClick, a, b) {
    return href
      ? h('a', { className: 'st-iconbtn', href: href, 'aria-label': label }, a, b || null)
      : h('button', { type: 'button', className: 'st-iconbtn', 'aria-label': label, onClick: onClick }, a, b || null);
  }

  window.Stride = Object.assign(window.Stride || {}, {
    Button: Button, Badge: Badge, Price: Price, Input: Input, SizePicker: SizePicker,
    QuantityStepper: QuantityStepper, WishlistButton: WishlistButton, ProductArt: ProductArt, ProductCard: ProductCard, CartItem: CartItem, Header: Header
  });
})();
