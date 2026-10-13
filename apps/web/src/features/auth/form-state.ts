// What a submitted auth form shows: the API's error body plus the values to
// keep in the fields. The password is never kept.
export type AuthFormState = {
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  /** Not tied to one field: throttling refusals. */
  formError?: string;
  values?: { name?: string; email?: string };
};
