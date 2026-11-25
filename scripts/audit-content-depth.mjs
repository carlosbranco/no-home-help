import {
  loadCityData,
  readLocations,
} from "./lib/city-data.mjs";

const strict = process.argv.includes("--strict");
const records = await loadCityData();
const locations = await readLocations();

const populationByPath = new Map(locations
  .filter((row) => row.record_type === "city")
  .map((row) => [
    `${row.country_slug}/${row.region_slug}/${row.place_slug}`,
    Number.parseInt(row.population, 10) || 0,
  ]));

function requirements(population) {
  if (population >= 1_000_000) return { resources: 20, categories: 10, shelter: 3, sources: 8 };
  if (population >= 500_000) return { resources: 16, categories: 8, shelter: 3, sources: 7 };
  if (population >= 200_000) return { resources: 12, categories: 7, shelter: 2, sources: 6 };
  return { resources: 8, categories: 5, shelter: 1, sources: 4 };
}

function hostname(website) {
  if (!website) return "";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hasEntries(city, ids) {
  return city.categories.some((category) => ids.includes(category.id) && category.entries.length > 0);
}

const results = records
  .filter((record) => record.data.status === "published" && record.data.locale.primary)
  .map((record) => {
    const city = record.data;
    const cityPath = `${city.location.country_slug}/${city.location.region_slug}/${city.location.city_slug}`;
    const population = populationByPath.get(cityPath) || 0;
    const expected = requirements(population);
    const filled = city.categories.filter((category) => category.entries.length > 0);
    const entries = filled.flatMap((category) => category.entries);
    const shelter = city.categories.find((category) => category.id === "shelter")?.entries.length || 0;
    const sources = new Set(entries.map((entry) => hostname(entry.website)).filter(Boolean)).size;
    const missingCore = [];

    if (!hasEntries(city, ["emergency"])) missingCore.push("emergency");
    if (!hasEntries(city, ["shelter"])) missingCore.push("shelter");
    if (!hasEntries(city, ["food"])) missingCore.push("food");
    if (!hasEntries(city, ["health", "mental-health"])) missingCore.push("health");
    if (!hasEntries(city, ["benefits", "specialist-support"])) missingCore.push("social support");
    if (population >= 200_000 && !hasEntries(city, ["employment"])) missingCore.push("employment");

    const problems = [];
    if (entries.length < expected.resources) problems.push(`${entries.length}/${expected.resources} resources`);
    if (filled.length < expected.categories) problems.push(`${filled.length}/${expected.categories} categories`);
    if (shelter < expected.shelter) problems.push(`${shelter}/${expected.shelter} shelter routes`);
    if (sources < expected.sources) problems.push(`${sources}/${expected.sources} source domains`);
    if (missingCore.length) problems.push(`missing ${missingCore.join(", ")}`);

    return {
      city: city.location.city_name,
      country: city.location.country_name,
      population,
      resources: entries.length,
      categories: filled.length,
      shelter,
      sources,
      expected,
      problems,
      file: record.relativeFile,
    };
  });

const failing = results
  .filter((result) => result.problems.length)
  .sort((a, b) => b.population - a.population || a.city.localeCompare(b.city));
const passing = results.length - failing.length;

process.stdout.write(`${JSON.stringify({
  publishedCities: results.length,
  passingDepthCheck: passing,
  needingMoreContent: failing.length,
  standards: {
    "1,000,000+": requirements(1_000_000),
    "500,000–999,999": requirements(500_000),
    "200,000–499,999": requirements(200_000),
    "under 200,000": requirements(0),
  },
}, null, 2)}\n`);

if (failing.length) {
  process.stdout.write("\nCities needing more content (largest first):\n");
  for (const result of failing) {
    process.stdout.write(`- ${result.city}, ${result.country} (${result.population || "population unknown"}): ${result.problems.join("; ")} — ${result.file}\n`);
  }
}

if (strict && failing.length) process.exit(1);
