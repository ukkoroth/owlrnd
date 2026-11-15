/** What a server action hands back to its form (used with React's useActionState). */
export type FormState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted text fields, so the form keeps them after an error. */
  values?: Record<string, string>;
  /** Marks the code boxes red (screen 5f). */
  codeInvalid?: boolean;
};

export const emptyForm: FormState = {};

export function text(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

/** The six code boxes are named d0…d5; a pasted or autofilled code may also arrive whole in d0. */
export function codeFrom(form: FormData): string {
  return Array.from({ length: 6 }, (_, i) => text(form, `d${i}`)).join("");
}
