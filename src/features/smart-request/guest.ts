/**
 * Smart Request (Radar) requester resolution: the signed-in account, or a guest identified by the signed device
 * cookie (see guest-core.ts). Server-only.
 */
import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { currentAccount } from "@/lib/auth-helpers";
import { GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, GUEST_OWNER_EMAIL, signGuestIds, verifyGuestIds, withRequest } from "./guest-core";
import type { Actor } from "./service";

export type Requester = { actor: Actor; guest: boolean };

let guestOwnerId: string | null = null;

/** The system owner row of guest requests: suspended, no password, an undeliverable address, so it can never sign in. */
async function guestOwner(): Promise<string> {
  if (guestOwnerId) return guestOwnerId;
  const row = await prisma.user.upsert({
    where: { email: GUEST_OWNER_EMAIL },
    create: { email: GUEST_OWNER_EMAIL, name: "Radar guest (system)", status: "suspended", role: "USER" },
    update: {},
    select: { id: true },
  });
  guestOwnerId = row.id;
  return row.id;
}

/** The device's own guest request ids (verified signature), or []. */
export async function guestRequestIds(): Promise<string[]> {
  const value = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!value) return [];
  return verifyGuestIds(serverEnv().AUTH_SECRET, value).catch(() => []);
}

/**
 * Who is acting. Signed-in: the account (unchanged behaviour). Guest: the system owner restricted to the device's own
 * request ids. `create` is true only for the create action, which may need the system owner before any request exists.
 */
export async function currentRequester(opts: { create?: boolean } = {}): Promise<Requester | null> {
  const user = await currentAccount().catch(() => null);
  if (user) return { actor: user, guest: false };
  const ids = await guestRequestIds();
  if (!ids.length && !opts.create) return null;
  const id = await guestOwner();
  return { actor: { id, email: GUEST_OWNER_EMAIL, role: "USER", requestIds: ids }, guest: true };
}

/** Remembers a new guest request on this device. */
export async function rememberGuestRequest(current: readonly string[], requestId: string): Promise<void> {
  const value = await signGuestIds(serverEnv().AUTH_SECRET, withRequest(current, requestId));
  (await cookies()).set(GUEST_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
}
