"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * A <select> that submits its form as soon as the value changes (progressive enhancement: without JavaScript the
 * form's own submit button still applies it). Works with the `form` attribute, so it may sit outside the <form>.
 */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/** The same for a checkbox/switch: one submit button per form, no separate "apply" button needed. */
export function AutoSubmitCheckbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} type="checkbox" onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
