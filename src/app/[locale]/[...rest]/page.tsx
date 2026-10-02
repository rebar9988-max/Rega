import { notFound } from "next/navigation";

/** Unknown localized URLs render the localized not-found page inside the shell. */
export default function CatchAll() {
  notFound();
}
