// Node and Worker builds resolve different Prisma clients. Next's persisted compilation cache can reuse
// the Node client in a later Worker build, leaving workerd trying to read an unbundled WASM file.
// Only generated build output is removed; source files, test traces and dependencies are preserved.
import { rmSync } from "node:fs";

rmSync(new URL("../.next/", import.meta.url), { recursive: true, force: true });
