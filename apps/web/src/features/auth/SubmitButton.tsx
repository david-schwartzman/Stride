"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";

/** Disabled while its form's action runs, so a double click can't submit twice. */
export function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      fullWidth
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
