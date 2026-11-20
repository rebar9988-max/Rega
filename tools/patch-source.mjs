// Screenshot-only patch of a throw-away copy of the source design: exposes the in-memory screen and language
// setters so each screen can be opened without clicking. The source repository itself is never changed.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const anchor = "const [screen, setScreen] = useState<ScreenId>('home');";
const src = readFileSync(file, "utf8");
if (!src.includes(anchor)) throw new Error("anchor not found in App.tsx");
writeFileSync(
  file,
  src.replace(anchor, `${anchor}\n  if (typeof window !== 'undefined') { (window as any).__rega = { setScreen, setLanguage }; }`),
);
console.log("patched", file);
