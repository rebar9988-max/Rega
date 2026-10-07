// Review by a German lawyer before relying on this text.
import { legalMetadata, legalPage } from "@/features/legal/LegalPage";

// Legal identity changes only with reviewed configuration/deploys. Let the edge reuse the
// rendered page so a transient Worker/database incident cannot unnecessarily take Impressum down.
export const revalidate = 3600;
export const generateMetadata = legalMetadata("impressum", "/impressum");
export default legalPage("impressum", "/impressum");
