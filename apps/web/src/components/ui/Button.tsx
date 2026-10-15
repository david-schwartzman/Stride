import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

// Props and looks from stride-design/design-system/components (index.d.ts ButtonProps, bundle.css .st-btn).
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = ink fill (default) · accent = volt, one per screen (Add to bag) · outline · ghost = text link look */
  variant?: "primary" | "accent" | "ink" | "outline" | "light" | "ghost";
  size?: "md" | "sm";
  fullWidth?: boolean;
  /** trailing arrow icon, for navigation-style CTAs (Shop now →) */
  arrow?: boolean;
}

const base =
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border-2 border-transparent font-bold uppercase tracking-[0.06em] cursor-pointer transition-[transform,background-color,border-color,color] duration-[120ms] ease-in-out active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-none";

const sizes = {
  md: "h-12 px-6 text-sm",
  // 36px visual height; the pseudo-element stretches the touch target to 44px.
  sm: "h-9 px-4 text-xs before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
} as const;

const variants = {
  primary: "bg-ink text-surface hover:bg-ink-muted",
  accent: "bg-volt text-on-volt hover:border-on-volt",
  ink: "bg-surface-inverse text-on-inverse hover:bg-ink-muted",
  outline: "bg-transparent text-ink border-ink hover:bg-ink hover:text-surface",
  light:
    "bg-transparent text-on-inverse border-on-inverse hover:bg-on-inverse hover:text-surface-inverse",
  ghost: "bg-transparent text-ink underline underline-offset-4 !px-2",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  arrow = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    base,
    sizes[size],
    variants[variant],
    fullWidth && "w-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {children}
      {arrow ? (
        <ArrowRight
          aria-hidden="true"
          className="size-[18px] flex-none transition-transform duration-150 group-hover:translate-x-[3px] motion-reduce:transition-none"
          strokeWidth={2}
        />
      ) : null}
    </button>
  );
}
