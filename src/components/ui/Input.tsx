import { useId, type InputHTMLAttributes, type ReactNode } from "react";

// Props and looks from stride-design/design-system/components (index.d.ts InputProps, bundle.css .st-input).
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** replaces the hint, marks the field aria-invalid; say how to fix it */
  error?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  "aria-describedby": describedBy,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  const msg = error || hint;
  const ariaDescribedBy =
    [msg ? msgId : undefined, describedBy].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div
      className={["flex min-w-60 flex-col gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <label
        htmlFor={inputId}
        className="text-xs font-bold uppercase tracking-[0.08em] text-ink"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ariaDescribedBy}
        className={[
          "h-12 rounded-sm bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:shadow-focus",
          error
            ? "border-2 border-sale"
            : "border border-line-strong hover:border-ink",
        ].join(" ")}
        {...rest}
      />
      {msg ? (
        <p
          id={msgId}
          className={`m-0 text-sm leading-5 ${error ? "text-sale" : "text-ink-muted"}`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
