/** Result of a form server action, rendered by the form component. */
export type FormState = { status: "idle" | "ok" | "error"; error?: "invalid" | "rate" | "failed"; fields?: string[] };
export const IDLE: FormState = { status: "idle" };
