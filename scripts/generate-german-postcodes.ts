/** Run with: node --import tsx scripts/generate-german-postcodes.ts /path/to/DE.txt */
import { readFileSync, writeFileSync } from "node:fs";
import { CITIES, REGIONS } from "../prisma/seed-data/geography";
import { GERMAN_CITIES } from "../prisma/seed-data/german-cities";

const source = process.argv[2];
if (!source) throw new Error("Pass DE.txt from the GeoNames postal code archive.");

const key = (name: string) => name.normalize("NFKC").trim().toLowerCase();
const regions = new Map(
  REGIONS.filter((region) => region.country === "DE")
    .flatMap((region) => [region.de, region.en].map((name) => [key(name), region.slug] as const)),
);
regions.set("land berlin", "berlin");
regions.set("mecklenburg-western pomerania", "mecklenburg-vorpommern");
const curated = CITIES.filter((city) => city.country === "DE");
const names = new Set(curated.map((city) => city.names.de));
const slugs = new Set(curated.map((city) => city.slug));
const citiesByName = new Map<string, Set<string>>();

function addCity(name: string, region: string, slug: string) {
  const id = `${region}/${key(name)}`;
  const matches = citiesByName.get(id) ?? new Set<string>();
  matches.add(slug);
  citiesByName.set(id, matches);
}

for (const city of curated) {
  if (city.region) addCity(city.names.de, city.region, city.slug);
}
for (const city of GERMAN_CITIES) {
  if (names.has(city.name) || slugs.has(city.slug)) continue;
  names.add(city.name);
  slugs.add(city.slug);
  addCity(city.name, city.region, city.slug);
}

const postcodes = new Map<string, Set<string>>();
for (const line of readFileSync(source, "utf8").split(/\r?\n/)) {
  const [country, code, name, state] = line.split("\t");
  if (country !== "DE" || !/^\d{5}$/.test(code)) continue;
  const region = regions.get(key(state ?? ""));
  const matches = citiesByName.get(`${region}/${key(name)}`);
  if (matches?.size !== 1) continue;
  const mapped = postcodes.get(code) ?? new Set<string>();
  for (const slug of matches) mapped.add(slug);
  postcodes.set(code, mapped);
}

if (!postcodes.get("51427")?.has("bergisch-gladbach")) throw new Error("The reference postcode did not match the city seed.");
const entries = [...postcodes].sort(([a], [b]) => a.localeCompare(b));
const lines = entries.map(([code, mapped]) => `  ${JSON.stringify(code)}: ${JSON.stringify([...mapped].sort())}`);
writeFileSync("src/lib/data/german-postcodes.json", `{\n${lines.join(",\n")}\n}\n`);
console.log(`Mapped ${entries.length} German postal codes to existing city slugs.`);
