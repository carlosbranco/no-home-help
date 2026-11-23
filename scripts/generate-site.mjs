import fs from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  escapeHtml,
  issueUrl,
  loadCityData,
  readLocations,
  uiFor,
} from "./lib/city-data.mjs";
import { FIXED_CATEGORY_IDS } from "./lib/categories.mjs";

const checkOnly = process.argv.includes("--check");
const pruneDrafts = process.argv.includes("--prune-drafts") || checkOnly;
const failures = [];
const writes = [];
const removals = [];
const templateDirectory = path.join(ROOT, "templates");

async function loadTemplate(name) {
  return fs.readFile(path.join(templateDirectory, name), "utf8");
}

const templates = {
  city: await loadTemplate("city.html"),
  root: await loadTemplate("index.html"),
  country: await loadTemplate("country.html"),
  region: await loadTemplate("region.html"),
};

function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key) => {
    if (!(key in values)) throw new Error(`Missing template value ${key}`);
    return values[key];
  });
}

function languageSuffix(language) {
  return language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function cityKey(city) {
  const location = city.location;
  return `${location.country_slug}/${location.region_slug}/${location.city_slug}`;
}

function cityFilename(city, extension) {
  const suffix = city.locale.primary ? "" : `.${languageSuffix(city.locale.language)}`;
  return `${city.location.city_slug}${suffix}.${extension}`;
}

function cityRelativePath(city) {
  const location = city.location;
  return `${location.country_slug}/${location.region_slug}/${cityFilename(city, "html")}`;
}

function dataRelativePath(city) {
  const location = city.location;
  return `data/cities/${location.country_slug}/${location.region_slug}/${cityFilename(city, "json")}`;
}

function visibleCategory(category) {
  return Array.isArray(category.entries) && category.entries.length > 0;
}

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

function validateText(value, context, { required = false } = {}) {
  if (typeof value !== "string") {
    failures.push(`${context}: must be text`);
    return;
  }
  if (required && !value.trim()) failures.push(`${context}: cannot be empty`);
  if (/<[^>]+>/.test(value)) failures.push(`${context}: HTML is not allowed in text data`);
}

function validateWebsite(value, context) {
  validateText(value, context);
  if (!value) return;
  if (!/^https?:\/\//i.test(value)) {
    failures.push(`${context}: website must start with http:// or https://`);
    return;
  }
  try { new URL(value); } catch { failures.push(`${context}: invalid website URL ${value}`); }
}

function validateCity(record) {
  const { data: city, relativeFile } = record;
  const context = relativeFile;
  if (typeof city.$schema !== "string" || !city.$schema) failures.push(`${context}: $schema is required`);
  if (typeof city.documentation !== "string" || !city.documentation) failures.push(`${context}: documentation is required`);
  if (city.schema_version !== 2) failures.push(`${context}: schema_version must be 2`);
  if (!["published", "draft"].includes(city.status)) failures.push(`${context}: status must be published or draft`);
  if (typeof city.locale?.primary !== "boolean") failures.push(`${context}: locale.primary must be true or false`);
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(city.locale?.language ?? "")) failures.push(`${context}: locale.language must be a BCP 47 language tag`);
  if (!["ltr", "rtl"].includes(city.locale?.direction)) failures.push(`${context}: locale.direction must be ltr or rtl`);
  const location = city.location ?? {};
  for (const field of ["continent", "country_code", "country_name", "country_local_name", "country_slug", "region_name", "region_slug", "city_name", "city_slug"]) {
    if (!location[field]) failures.push(`${context}: missing location.${field}`);
  }
  if (city.locale && city.location) {
    const expectedFile = dataRelativePath(city);
    if (expectedFile !== relativeFile) failures.push(`${context}: path must match location slugs (${expectedFile})`);
  }
  for (const field of ["title", "description"]) if (!city.seo?.[field]) failures.push(`${context}: missing seo.${field}`);
  if (!city.page?.heading) failures.push(`${context}: missing page.heading`);
  if (!validIsoDate(city.page?.last_verified)) failures.push(`${context}: page.last_verified must be a real date in YYYY-MM-DD`);
  for (const field of ["urgent", "notice", "intro", "footer"]) validateText(city.page?.[field], `${context}: page.${field}`);
  const categoryIds = new Set();
  if (!Array.isArray(city.categories) || city.categories.length !== FIXED_CATEGORY_IDS.length) {
    failures.push(`${context}: categories must contain the ${FIXED_CATEGORY_IDS.length} fixed categories`);
  }
  for (const [categoryIndex, category] of (city.categories ?? []).entries()) {
    const expectedId = FIXED_CATEGORY_IDS[categoryIndex];
    if (category.id !== expectedId) failures.push(`${context}: category ${categoryIndex + 1} must be ${expectedId}`);
    if (categoryIds.has(category.id)) failures.push(`${context}: duplicate category id ${category.id}`);
    categoryIds.add(category.id);
    validateText(category.title, `${context}: ${category.id}.title`, { required: true });
    if (!Array.isArray(category.entries)) failures.push(`${context}: ${category.id}.entries must be an array`);
    const entryIds = new Set();
    for (const entry of category.entries ?? []) {
      if (entryIds.has(entry.id)) failures.push(`${context}: duplicate entry id ${category.id}/${entry.id}`);
      entryIds.add(entry.id);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id ?? "")) failures.push(`${context}: ${category.id} has invalid entry id ${entry.id}`);
      validateText(entry.title, `${context}: ${category.id}/${entry.id}.title`, { required: true });
      validateText(entry.description, `${context}: ${category.id}/${entry.id}.description`, { required: true });
      if (!validIsoDate(entry.last_verified)) failures.push(`${context}: ${category.id}/${entry.id} needs a real last_verified date in YYYY-MM-DD`);
      for (const field of ["address", "phone", "hours", "how_to_access"]) validateText(entry[field], `${context}: ${category.id}/${entry.id}.${field}`);
      validateWebsite(entry.website, `${context}: ${category.id}/${entry.id}.website`);
    }
  }
  if (city.status === "published" && !(city.categories ?? []).some(visibleCategory)) failures.push(`${context}: a published city needs at least one non-empty category`);
}

function entryAnchor(categoryId, entryId) {
  return `${categoryId}--${entryId}`;
}

function renderLinkedText(value = "") {
  const pattern = /(https?:\/\/[^\s]+|tel:[+*#0-9][^\s]*)/gi;
  const directionsPattern = /https?:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.apple\.|(?:www\.)?openstreetmap\.org\/directions|(?:www\.)?waze\.com)/i;
  const lines = value.split(/\r?\n/);
  return lines.map((line, index) => {
    let output = "";
    let cursor = 0;
    let containsDirectionsLink = false;
    for (const match of line.matchAll(pattern)) {
      output += escapeHtml(line.slice(cursor, match.index));
      const href = match[0];
      const label = href.startsWith("tel:") ? href.slice(4) : href;
      if (directionsPattern.test(href)) containsDirectionsLink = true;
      output += `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
      cursor = match.index + href.length;
    }
    output += escapeHtml(line.slice(cursor));
    const lineBreak = index < lines.length - 1 ? "<br>" : "";
    return containsDirectionsLink
      ? `<span class="directions-link-line">${output}${lineBreak}</span>`
      : `${output}${lineBreak}`;
  }).join("");
}

function renderTextBlock(value, indent = "    ") {
  if (!value?.trim()) return "";
  return value.trim().split(/\n{2,}/).map((paragraph) => `${indent}<p>${renderLinkedText(paragraph)}</p>`).join("\n");
}

function telephoneHref(phone) {
  const normalized = phone.replace(/[^+*#0-9]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function websiteLabel(website) {
  try {
    const url = new URL(website);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return website;
  }
}

function renderEntry(entry, category, city, ui, legacyAlias = false) {
  const details = [];
  if (entry.description) details.push(`        <p>${renderLinkedText(entry.description)}</p>`);
  if (entry.address) details.push(`        <address>${renderLinkedText(entry.address)}</address>`);
  if (entry.phone) {
    const href = telephoneHref(entry.phone);
    details.push(href
      ? `        <p><a href="${escapeHtml(href)}">${escapeHtml(entry.phone)}</a></p>`
      : `        <p>${escapeHtml(entry.phone)}</p>`);
  }
  if (entry.website) details.push(`        <p><a href="${escapeHtml(entry.website)}">${escapeHtml(websiteLabel(entry.website))}</a></p>`);
  if (entry.hours) details.push(`        <p>${renderLinkedText(entry.hours)}</p>`);
  if (entry.how_to_access) details.push(`        <p>${renderLinkedText(entry.how_to_access)}</p>`);
  return [
    `      <article class="resource" id="${escapeHtml(entryAnchor(category.id, entry.id))}">`,
    legacyAlias ? `        <span id="${escapeHtml(entry.id)}" class="anchor-alias" aria-hidden="true"></span>` : "",
    `        <h3>${escapeHtml(entry.title)}</h3>`,
    ...details,
    `        <p class="meta"><strong>${escapeHtml(ui.verified)}:</strong> ${escapeHtml(entry.last_verified)}</p>`,
    `        <p class="entry-report"><a href="${escapeHtml(issueUrl(city, `${category.id}/${entry.id}`))}">${escapeHtml(ui.report)}</a></p>`,
    "      </article>",
  ].filter(Boolean).join("\n");
}

function renderAlternateLinks(translations) {
  const links = translations.map((translation) => `  <link rel="alternate" hreflang="${escapeHtml(translation.locale.language)}" href="https://nohomehelp.com/${escapeHtml(cityRelativePath(translation))}">`);
  const primary = translations.find((translation) => translation.locale.primary);
  if (primary) links.push(`  <link rel="alternate" hreflang="x-default" href="https://nohomehelp.com/${escapeHtml(cityRelativePath(primary))}">`);
  return links.join("\n");
}

function renderLanguageSwitcher(city, translations) {
  if (translations.length < 2) return "";
  const links = translations.map((translation) => {
    const current = translation.locale.language.toLowerCase() === city.locale.language.toLowerCase();
    const filename = cityFilename(translation, "html");
    const label = escapeHtml(translation.locale.language);
    return current ? `      <li><strong lang="${label}" aria-current="page">${label}</strong></li>` : `      <li><a href="${escapeHtml(filename)}" hreflang="${label}" lang="${label}">${label}</a></li>`;
  }).join("\n");
  return `    <nav class="language-switcher" aria-label="Language versions">\n      <ul>\n${links}\n      </ul>\n    </nav>`;
}

function renderCity(city, translations) {
  const ui = uiFor(city.locale.language);
  const dir = city.locale.direction === "rtl" ? " dir=\"rtl\"" : "";
  const location = city.location;
  const categories = city.categories.filter(visibleCategory);
  const urgent = renderTextBlock(city.page.urgent);
  const intro = renderTextBlock(city.page.intro);
  const contents = categories.map((category) => {
    return `        <li><a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a></li>`;
  }).join("\n");
  const reservedIds = new Set(["top", "main-content", "contents-title", ...categories.map((category) => category.id)]);
  const legacyOwners = new Map();
  for (const category of categories) {
    for (const entry of category.entries) {
      if (!reservedIds.has(entry.id) && !legacyOwners.has(entry.id)) legacyOwners.set(entry.id, `${category.id}/${entry.id}`);
    }
  }
  const sections = categories.map((category) => {
    const entries = category.entries.map((entry) => renderEntry(entry, category, city, ui, legacyOwners.get(entry.id) === `${category.id}/${entry.id}`)).join("\n");
    return [
      `    <section id="${escapeHtml(category.id)}">`,
      `      <h2>${escapeHtml(category.title)}</h2>`,
      entries,
      `      <p class="back-to-top"><a href="#top">${escapeHtml(ui.back)}</a></p>`,
      "    </section>",
    ].join("\n");
  }).join("\n\n");
  const footerBlocks = renderTextBlock(city.page.footer);
  return fillTemplate(templates.city, {
    LANG: escapeHtml(city.locale.language),
    DIR: dir,
    DESCRIPTION: escapeHtml(city.seo.description),
    TITLE: escapeHtml(city.seo.title),
    CANONICAL_URL: `https://nohomehelp.com/${escapeHtml(cityRelativePath(city))}`,
    ALTERNATES: renderAlternateLinks(translations),
    DATA_FILE: escapeHtml(dataRelativePath(city)),
    SKIP_LABEL: escapeHtml(ui.contents),
    LOCATION_LABEL: escapeHtml(ui.location),
    COUNTRY_NAME: escapeHtml(location.country_local_name),
    REGION_NAME: escapeHtml(location.region_name),
    CITY_NAME: escapeHtml(location.city_name),
    LANGUAGE_SWITCHER: renderLanguageSwitcher(city, translations),
    HEADING: escapeHtml(city.page.heading),
    URGENT: urgent,
    VERIFIED_LABEL: escapeHtml(ui.verified),
    LAST_VERIFIED: escapeHtml(city.page.last_verified),
    NOTICE: renderLinkedText(city.page.notice),
    INTRO: intro,
    CONTENTS_LABEL: escapeHtml(ui.contents),
    CONTENTS: contents,
    SECTIONS: sections,
    FOOTER_BLOCKS: footerBlocks,
    REPORT_URL: escapeHtml(issueUrl(city)),
    REPORT_LABEL: escapeHtml(ui.report),
    CONTRIBUTE_LABEL: escapeHtml(ui.contribute),
  });
}

function renderRootIndex(published) {
  const continents = new Map();
  for (const city of published) {
    const continent = city.location.continent || "Other";
    if (!continents.has(continent)) continents.set(continent, new Map());
    const countries = continents.get(continent);
    const key = city.location.country_slug;
    if (!countries.has(key)) countries.set(key, { city, count: 0 });
    countries.get(key).count += 1;
  }
  const sections = [...continents.entries()].map(([continent, countries]) => {
    const list = [...countries.values()].sort((a, b) => a.city.location.country_local_name.localeCompare(b.city.location.country_local_name)).map(({ city, count }) => {
      const location = city.location;
      return `        <li><a href="${escapeHtml(location.country_slug)}/index.html" hreflang="${escapeHtml(city.locale.language)}"><span lang="${escapeHtml(city.locale.language)}">${escapeHtml(location.country_local_name)}</span></a> — ${count}</li>`;
    }).join("\n");
    return `    <section>\n      <h2>${escapeHtml(continent)}</h2>\n      <ul>\n${list}\n      </ul>\n    </section>`;
  }).join("\n");
  return fillTemplate(templates.root, { SECTIONS: sections });
}

function renderCountryIndex(cities) {
  const first = cities[0];
  const ui = uiFor(first.locale.language);
  const location = first.location;
  const dir = first.locale.direction === "rtl" ? " dir=\"rtl\"" : "";
  const regions = new Map();
  for (const city of cities) {
    if (!regions.has(city.location.region_slug)) regions.set(city.location.region_slug, []);
    regions.get(city.location.region_slug).push(city);
  }
  const sections = [...regions.values()].sort((a, b) => a[0].location.region_name.localeCompare(b[0].location.region_name)).map((regionCities) => {
    regionCities.sort((a, b) => a.location.city_name.localeCompare(b.location.city_name));
    const region = regionCities[0].location;
    const list = regionCities.map((city) => `        <li><a href="${escapeHtml(region.region_slug)}/${escapeHtml(city.location.city_slug)}.html">${escapeHtml(city.location.city_name)}</a></li>`).join("\n");
    return `    <section>\n      <h3><a href="${escapeHtml(region.region_slug)}/index.html">${escapeHtml(region.region_name)}</a></h3>\n      <ul>\n${list}\n      </ul>\n    </section>`;
  }).join("\n");
  return fillTemplate(templates.country, {
    LANG: escapeHtml(first.locale.language),
    DIR: dir,
    DESCRIPTION: `${escapeHtml(ui.cities)}: ${escapeHtml(location.country_local_name)}.`,
    TITLE: `${escapeHtml(location.country_local_name)} - No Home Help`,
    CANONICAL_URL: `https://nohomehelp.com/${escapeHtml(location.country_slug)}/`,
    LOCATION_LABEL: escapeHtml(ui.location),
    COUNTRY_NAME: escapeHtml(location.country_local_name),
    CITIES_LABEL: escapeHtml(ui.cities),
    SECTIONS: sections || `    <p>${escapeHtml(ui.noGuides)}</p>`,
    CONTRIBUTE_LABEL: escapeHtml(ui.contribute),
  });
}

function renderRegionIndex(cities) {
  const first = cities[0];
  const ui = uiFor(first.locale.language);
  const location = first.location;
  const dir = first.locale.direction === "rtl" ? " dir=\"rtl\"" : "";
  const list = [...cities].sort((a, b) => a.location.city_name.localeCompare(b.location.city_name)).map((city) => `      <li><a href="${escapeHtml(city.location.city_slug)}.html">${escapeHtml(city.location.city_name)}</a></li>`).join("\n");
  return fillTemplate(templates.region, {
    LANG: escapeHtml(first.locale.language),
    DIR: dir,
    DESCRIPTION: `${escapeHtml(ui.cities)}: ${escapeHtml(location.region_name)}.`,
    TITLE: `${escapeHtml(location.region_name)} - No Home Help`,
    CANONICAL_URL: `https://nohomehelp.com/${escapeHtml(location.country_slug)}/${escapeHtml(location.region_slug)}/`,
    LOCATION_LABEL: escapeHtml(ui.location),
    COUNTRY_NAME: escapeHtml(location.country_local_name),
    REGION_NAME: escapeHtml(location.region_name),
    CITIES_LABEL: escapeHtml(ui.cities),
    CITY_LIST: list,
    CONTRIBUTE_LABEL: escapeHtml(ui.contribute),
  });
}

async function queueWrite(relativePath, content) {
  const target = path.join(ROOT, relativePath);
  let current = null;
  try { current = await fs.readFile(target, "utf8"); } catch {}
  if (current === content) return;
  if (checkOnly) failures.push(`${relativePath}: generated output is out of date`);
  else writes.push({ target, content });
}

async function queueRemoval(target, reason) {
  try { await fs.access(target); } catch { return; }
  const relative = path.relative(ROOT, target).split(path.sep).join("/");
  if (checkOnly) failures.push(`${relative}: ${reason}`);
  else removals.push(target);
}

async function generatedHtmlFiles() {
  const excludedAtRoot = new Set([".git", ".github", "data", "templates", "schemas", "scripts", "node_modules"]);
  const output = [];
  async function walk(directory, atRoot = false) {
    let entries = [];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (atRoot && excludedAtRoot.has(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) output.push(full);
    }
  }
  await walk(ROOT, true);
  return output;
}

const records = await loadCityData();
for (const record of records) validateCity(record);
const published = records.filter((record) => record.data.status === "published").map((record) => record.data);
const translationsByCity = new Map();
for (const city of published) {
  const key = cityKey(city);
  if (!translationsByCity.has(key)) translationsByCity.set(key, []);
  translationsByCity.get(key).push(city);
}
for (const [key, translations] of translationsByCity) {
  const languages = new Set();
  for (const city of translations) {
    const language = city.locale.language.toLowerCase();
    if (languages.has(language)) failures.push(`${key}: duplicate published language ${city.locale.language}`);
    languages.add(language);
  }
  const primaries = translations.filter((city) => city.locale.primary);
  if (primaries.length !== 1) failures.push(`${key}: published translations need exactly one primary local-language file`);
  translations.sort((a, b) => Number(b.locale.primary) - Number(a.locale.primary) || a.locale.language.localeCompare(b.locale.language));
}
const primaryPublished = published.filter((city) => city.locale.primary);
const publishedPaths = new Set(published.map(cityRelativePath));
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

for (const city of published) await queueWrite(cityRelativePath(city), renderCity(city, translationsByCity.get(cityKey(city))));
await queueWrite("index.html", renderRootIndex(primaryPublished));

const byCountry = new Map();
const byRegion = new Map();
for (const city of primaryPublished) {
  if (!byCountry.has(city.location.country_slug)) byCountry.set(city.location.country_slug, []);
  byCountry.get(city.location.country_slug).push(city);
  const regionKey = `${city.location.country_slug}/${city.location.region_slug}`;
  if (!byRegion.has(regionKey)) byRegion.set(regionKey, []);
  byRegion.get(regionKey).push(city);
}
for (const [country, cities] of byCountry) await queueWrite(`${country}/index.html`, renderCountryIndex(cities));
for (const [region, cities] of byRegion) await queueWrite(`${region}/index.html`, renderRegionIndex(cities));

if (pruneDrafts) {
  const desiredGeneratedPaths = new Set(["index.html", ...publishedPaths]);
  for (const country of byCountry.keys()) desiredGeneratedPaths.add(`${country}/index.html`);
  for (const region of byRegion.keys()) desiredGeneratedPaths.add(`${region}/index.html`);
  const locations = await readLocations();
  for (const row of locations.filter((item) => item.record_type === "city" && item.page_status !== "verified")) {
    const relative = `${row.country_slug}/${row.region_slug}/${row.place_slug}.html`;
    if (publishedPaths.has(relative)) continue;
    const target = path.join(ROOT, relative);
    try {
      const html = await fs.readFile(target, "utf8");
      if (html.includes("Generated draft city scaffold")) await queueRemoval(target, "unpublished generated draft must be removed");
    } catch {}
  }
  for (const target of await generatedHtmlFiles()) {
    const relative = path.relative(ROOT, target).split(path.sep).join("/");
    if (desiredGeneratedPaths.has(relative)) continue;
    const html = await fs.readFile(target, "utf8");
    if (html.includes("Generated from data/cities/")
      || html.includes("Generated from primary published files in data/cities/")
      || html.includes("Generated geographic index from data/locations.csv.")) {
      await queueRemoval(target, "generated page has no published JSON source");
    }
  }
}

if (checkOnly) {
  if (failures.length) {
    process.stderr.write(`${failures.join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Generated output is current for ${published.length} published guides in ${primaryPublished.length} cities.\n`);
} else {
  for (const { target, content } of writes) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
  for (const target of removals) await fs.unlink(target);
  process.stdout.write(`Generated ${published.length} published guides in ${primaryPublished.length} cities; wrote ${writes.length} files and removed ${removals.length} generated drafts.\n`);
}
