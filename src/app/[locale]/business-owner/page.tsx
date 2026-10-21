import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { BUSINESS_HOME, BUSINESS_NEW } from "@/features/business/paths";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** One public entry; authentication never grants a role or business membership. */
export default async function BusinessEntry({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<{ add?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const target = (await searchParams).add === "1" ? BUSINESS_NEW : BUSINESS_HOME;
  if ((await auth())?.user) redirect(target);
  redirect(`/${locale}/login?next=${encodeURIComponent(target)}`);
}
