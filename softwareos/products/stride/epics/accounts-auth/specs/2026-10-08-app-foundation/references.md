# References for App Foundation

## Related Specs

_None._ — first spec in the project; no `specs.index.yml` existed anywhere at shaping time, so the Step 4 pre-flight found no coverage to overlap.

## Upstream Meeting

None.

## Similar Implementations

Greenfield — no app code exists yet. The references are the design handoff, used in place (not copied into `visuals/`).

### Design tokens

- **Location:** `stride-design/design-system/tokens.json`, `stride-design/design-system/tokens.css`, `stride-design/design-system/README.md`
- **Relevance:** Source for the Tailwind theme (AC6).
- **Key patterns:** README's "Using it with Tailwind" mapping (`bg-volt text-on-volt rounded-pill`); volt only for action buttons; accessibility checklist (skip link, focus ring, ≥44px targets, labelled inputs with `aria-describedby`).

### Header, Button, Input components

- **Location:** `stride-design/design-system/components/{Header,Button,Input}/`, `components/index.d.ts`, `components/bundle.css`
- **Relevance:** Props and styling for the primitives and Header (AC7, AC9).
- **Key patterns:** `HeaderProps` (`links`, `active`, `cartCount`, `accountName`, `…Href`); cart count hidden at 0; sticky header; menu drawer below `bp-md`; `InputProps { label, hint, error }`.

### Page references

- **Location:** `stride-design/pages/Footer.dc.html`, `Main.dc.html`, `MobileHome.dc.html`
- **Relevance:** Footer layout (AC8) and header/footer at desktop + 375px (AC10). Visual reference only — rebuild, don't copy.

