import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import styles from "./premium.module.css";

export { styles };

/** Page-scoped presentation of the approved WebsitePublisher v3 references. */
export function PremiumHero({ eyebrow, title, lead, children, art }: { eyebrow: string; title: string; lead: string; children: ReactNode; art: ReactNode }) {
  return <section className={styles.hero}><div className={styles.heroGrid}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p className={styles.lead}>{lead}</p><div className={styles.actions}>{children}</div></div><div className={styles.art}><div className={styles.redtop} />{art}</div></div></section>;
}

export function FeatureNav({ business, ai, cities }: { business: string; ai: string; cities: string }) {
  return <nav className={styles.featureNav} aria-label="Rega24"><Link href="/for-business">{business}</Link><Link href="/ai">REGA AI · {ai}</Link><Link href="/locations">{cities}</Link></nav>;
}
