/** What the /admin sign-in form shows: which step it is on, and the one line under it. */
export type CodeFormState = {
  step: "email" | "code";
  email: string;
  tone: "idle" | "note" | "error";
  message: string;
};

export const CODE_IDLE: CodeFormState = { step: "email", email: "", tone: "idle", message: "" };
