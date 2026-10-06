import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

function safeNext(value: FormDataEntryValue | string | undefined | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/ckb";
}

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const session = await auth().catch(() => null);
  if (session?.user?.role === "SUPER_ADMIN") redirect(safeNext(next));

  async function login(formData: FormData) {
    "use server";
    const ip = clientIp(await headers());
    const target = safeNext(formData.get("next"));
    if (!(await allowShared("LOGIN_LIMITER", `owner-login-ip:${ip}`, Number(process.env.AUTH_LOGIN_ATTEMPTS ?? 10) * 3, 15 * 60_000))) {
      redirect(`/owner-login?error=rate&next=${encodeURIComponent(target)}`);
    }
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/owner-login?error=1&next=${encodeURIComponent(target)}`);
      throw e;
    }
    redirect(target);
  }

  const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand";
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p dir="ltr" className="text-3xl font-black text-brand">REGA</p>
          <h1 className="mt-2 text-xl font-extrabold">چوونەژوورەوەی خاوەن</h1>
          <p className="mt-1 text-sm text-muted">Private Beta</p>
        </div>
        <form action={login} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card">
          {error && (
            <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">
              {error === "rate" ? "هەوڵی زۆر دراوە. دواتر هەوڵ بدەرەوە." : "ئیمەیڵ یان وشەی نهێنی هەڵەیە."}
            </p>
          )}
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold">ئیمەیڵ</label>
            <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={`${field} text-start`} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold">وشەی نهێنی</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" dir="ltr" className={`${field} text-start`} />
          </div>
          <button type="submit" className="min-h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-hover">
            چوونەژوورەوە
          </button>
        </form>
      </section>
    </main>
  );
}
