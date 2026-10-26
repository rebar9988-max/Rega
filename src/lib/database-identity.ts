import project from "@/config/project.json";

/** Compares the configured endpoint with verified public Neon metadata; never returns any URL or credential. */
export function databaseTargetMatchesManifest(connection: string | undefined): boolean {
  if (!connection) return false;
  try {
    const url = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || (url.port && url.port !== "5432")) return false;
    if (!project.neonProductionHosts.includes(url.hostname.toLowerCase())) return false;
    if (decodeURIComponent(url.pathname.slice(1)) !== project.neonProductionDatabase) return false;
    for (const [name, value] of url.searchParams) {
      const key = name.toLowerCase();
      if (["hostaddr", "service"].includes(key)) return false;
      if (key === "host" && value.toLowerCase() !== url.hostname.toLowerCase()) return false;
      if (key === "port" && value !== "5432") return false;
      if (["dbname", "database"].includes(key) && value !== project.neonProductionDatabase) return false;
    }
    return true;
  } catch { return false; }
}
