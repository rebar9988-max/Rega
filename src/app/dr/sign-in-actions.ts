"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { clientIp } from "@/lib/client-ip";
import { requestAdminCode } from "@/features/auth/admin-code";

/** What the sign-in form shows: which step it is on, and the one line under it. */
export type CodeFormState = {
  step: "email" | "code";
  email: string;
  tone: "idle" | "note" | "error";
  message: string;
};

export const CODE_IDLE: CodeFormState = { step: "email", email: "", tone: "idle", message: "" };

/**
 * Ask for a code. Every address gets the same answer, so this never reveals who holds
 * dashboard access.
 */
export async function sendDashboardCode(
  prev: CodeFormState,
  formData: FormData,
): Promise<CodeFormState> {
  const typed = String(formData.get("email") ?? "");
  const ip = clientIp(await headers());
  const result = await requestAdminCode(typed, ip);
  const email = typed.trim().toLowerCase();
  if ("error" in result) {
    const message =
      result.error === "email"
        ? "ئەم ئیمەیڵە دروست نییە."
        : result.error === "rate"
          ? "هەوڵی زۆر دراوە. چەند چرکەیەک بوەستە و دووبارە هەوڵ بدەرەوە."
          : "ناردنی کۆد ئێستا بەردەست نییە. دواتر هەوڵ بدەرەوە.";
    return { ...prev, step: prev.step, email, tone: "error", message };
  }
  return {
    step: "code",
    email,
    tone: "note",
    message: "ئەگەر ئەم ئیمەیڵە مافی بەڕێوەبەری هەبێت، کۆدێکمان بۆ نارد.",
  };
}

/**
 * Check a code and open a session. The check happens once, inside the `admin-code` provider:
 * it is what spends the guess, so the code cannot be tried twice per submission.
 */
export async function verifyDashboardCode(
  prev: CodeFormState,
  formData: FormData,
): Promise<CodeFormState> {
  const email = String(formData.get("email") ?? prev.email);
  const code = String(formData.get("code") ?? "");
  try {
    await signIn("admin-code", { email, code, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        step: "code",
        email,
        tone: "error",
        message: "کۆدەکە هەڵەیە، بەسەرچووە یان بەکارهاتووە. کۆدێکی نوێ داوا بکە.",
      };
    }
    throw error;
  }
  // Signed in: load the dashboard with the new session.
  redirect("/dr");
}
