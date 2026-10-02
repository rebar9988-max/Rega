// Review by a German lawyer before relying on this text.
import { legalMetadata, legalPage } from "@/features/legal/LegalPage";

// The operator's details come from the environment at request time (src/config/owner.ts); the edge cache still serves repeat visits.
export const dynamic = "force-dynamic";
export const generateMetadata = legalMetadata("impressum", "/impressum");
export default legalPage("impressum", "/impressum");
