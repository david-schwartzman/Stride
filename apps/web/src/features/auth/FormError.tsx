/** Errors not tied to one field (throttling). Announced when it appears. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="m-0 bg-sale-soft px-4 py-3 text-sm leading-5 text-sale"
    >
      {message}
    </p>
  );
}
