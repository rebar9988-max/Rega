/** Runs once at server start (Node runtime): validates the environment so a misconfiguration shows up in the logs at boot. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { serverEnv } = await import("@/lib/env");
    serverEnv();
  } catch (error) {
    // Logged, not thrown: /api/v1/health lists the missing variable names and the public site must not go down on a typo.
    console.error(JSON.stringify({ level: "error", app: "rega", message: "env.invalid", error: error instanceof Error ? error.message : String(error) }));
  }
}
