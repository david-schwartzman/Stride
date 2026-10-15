// First focusable element on every page (AC10); bundle.css .st-skip.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute -top-12 left-4 z-30 rounded-sm bg-ink px-4 py-2 font-bold text-surface focus:top-2 focus:outline-none focus:shadow-focus"
    >
      Skip to content
    </a>
  );
}
