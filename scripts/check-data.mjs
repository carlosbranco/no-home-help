import {
  loadCityData,
  readLocations,
} from "./lib/city-data.mjs";

const checkExternal = process.argv.includes("--external-links");
const records = await loadCityData();
const locations = await readLocations();
const failures = [];
const urls = new Set();
let resources = 0;
let categories = 0;
let telephoneLinks = 0;

function collectUrls(value = "") {
  for (const match of value.matchAll(/https?:\/\/[^\s]+/gi)) {
    urls.add(match[0].replace(/[),.;]+$/, ""));
  }
}

const published = records.filter((record) => record.data.status === "published");
const jsonPaths = new Map();
const primaryCityPaths = new Map();
for (const record of published) {
  const city = record.data;
  const cityPath = `${city.location.country_slug}/${city.location.region_slug}/${city.location.city_slug}`;
  const key = `${cityPath}/${city.locale.language.toLowerCase()}`;
  if (jsonPaths.has(key)) failures.push(`${record.relativeFile}: duplicate city path also used by ${jsonPaths.get(key)}`);
  jsonPaths.set(key, record.relativeFile);
  if (city.locale.primary) {
    if (primaryCityPaths.has(cityPath)) failures.push(`${record.relativeFile}: another primary language file exists at ${primaryCityPaths.get(cityPath)}`);
    primaryCityPaths.set(cityPath, record.relativeFile);
  }

  collectUrls(city.page.urgent);
  collectUrls(city.page.notice);
  collectUrls(city.page.intro);
  collectUrls(city.page.footer);
  for (const category of city.categories) {
    if (!category.entries.length) continue;
    categories += 1;
    const entryIds = new Set();
    for (const entry of category.entries) {
      resources += 1;
      if (entryIds.has(entry.id)) failures.push(`${record.relativeFile}: duplicate entry ${category.id}/${entry.id}`);
      entryIds.add(entry.id);
      if (entry.phone) telephoneLinks += 1;
      if (entry.website) urls.add(entry.website);
      collectUrls(entry.description);
      collectUrls(entry.address);
      collectUrls(entry.hours);
      collectUrls(entry.how_to_access);
    }
  }
}

const csvVerified = new Set(locations
  .filter((row) => row.record_type === "city" && row.page_status === "verified")
  .map((row) => `${row.country_slug}/${row.region_slug}/${row.place_slug}`));
for (const city of csvVerified) if (!primaryCityPaths.has(city)) failures.push(`data/locations.csv: verified city has no published primary JSON: ${city}`);
for (const [city, file] of primaryCityPaths) if (!csvVerified.has(city)) failures.push(`${file}: published primary JSON is not verified in data/locations.csv`);

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "user-agent": "NoHomeHelp-LinkCheck/1.0" } });
    if ([400, 405, 501].includes(response.status)) response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "NoHomeHelp-LinkCheck/1.0", range: "bytes=0-2048" } });
    if ([404, 410].includes(response.status)) return `${url}: HTTP ${response.status}`;
    return null;
  } catch (error) {
    return `${url}: ${error.name === "AbortError" ? "timeout" : error.message}`;
  } finally {
    clearTimeout(timeout);
  }
}

if (checkExternal) {
  const queue = [...urls];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(10, queue.length) }, async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const failure = await checkUrl(queue[index]);
      if (failure) failures.push(failure);
    }
  });
  await Promise.all(workers);
}

if (failures.length) {
  process.stderr.write(`Failures:\n${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({
  publishedGuides: published.length,
  publishedCities: primaryCityPaths.size,
  categories,
  resources,
  telephoneLinks,
  uniqueExternalLinks: urls.size,
  csvVerifiedCities: csvVerified.size,
  externalLinksChecked: checkExternal ? urls.size : 0,
}, null, 2)}\n`);
