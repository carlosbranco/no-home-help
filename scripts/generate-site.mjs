import fs from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  escapeHtml,
  inlineText,
  issueUrl,
  loadCityData,
  readLocations,
  renderBlock,
  renderInline,
  uiFor,
} from "./lib/city-data.mjs";

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

function visibleBlock(block) {
  if (block.type === "paragraph" || block.type === "address") return Boolean(inlineText(block.content));
  return Array.isArray(block.items) && block.items.some((item) => inlineText(item));
}

function visibleCategory(category) {
  return category.items.some((item) => item.type === "resource" ? item.name && item.blocks.some(visibleBlock) : visibleBlock(item));
}

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

function validateHref(href, context) {
  if (/^tel:/i.test(href)) {
    if (!/^tel:(?:%23|[+*#0-9])[0-9*#%(). -]*$/i.test(href)) failures.push(`${context}: invalid telephone link ${href}`);
  } else if (/^https?:\/\//i.test(href)) {
    try { new URL(href); } catch { failures.push(`${context}: invalid URL ${href}`); }
  } else if (/^mailto:[^\s]+$/i.test(href)
    || /^sms:[+0-9*#%(),;.-]+(?:\?[^\s]*)?$/i.test(href)
    || /^#[a-z0-9][a-z0-9_-]*$/i.test(href)
    || /^(?:\.\.\/|[a-z0-9./_-]+(?:\.html|\.md)(?:#.*)?)$/i.test(href)) {
    return;
  } else {
    failures.push(`${context}: unsupported link ${href}`);
  }
}

function validateInline(inline, context) {
  if (typeof inline === "string") {
    if (/<[^>]+>/.test(inline)) failures.push(`${context}: HTML is not allowed in text data`);
    return;
  }
  if (!Array.isArray(inline)) failures.push(`${context}: inline content must be an array`);
  for (const segment of inline ?? []) {
    if (segment.href) validateHref(segment.href, context);
    if (segment.text && /<[^>]+>/.test(segment.text)) failures.push(`${context}: HTML is not allowed in text data`);
  }
}

function validateBlock(block, context) {
  if (["paragraph", "address"].includes(block.type)) validateInline(block.content, context);
  else if (["list", "ordered-list"].includes(block.type)) for (const item of block.items ?? []) validateInline(item, context);
  else failures.push(`${context}: unknown block type ${block.type}`);
}

function validateCity(record) {
  const { data: city, relativeFile } = record;
  const context = relativeFile;
  if (typeof city.$schema !== "string" || !city.$schema) failures.push(`${context}: $schema is required`);
  if (city.schema_version !== 1) failures.push(`${context}: schema_version must be 1`);
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
  for (const block of city.page?.urgent ?? []) validateBlock(block, `${context}: urgent`);
  validateInline(city.page?.notice ?? [], `${context}: notice`);
  for (const block of city.page?.intro ?? []) validateBlock(block, `${context}: intro`);
  for (const block of city.page?.footer ?? []) validateBlock(block, `${context}: footer`);
  const categoryIds = new Set();
  const resourcesByCategory = new Map();
  for (const category of city.categories ?? []) {
    if (categoryIds.has(category.id)) failures.push(`${context}: duplicate category id ${category.id}`);
    categoryIds.add(category.id);
    const resourceIds = new Set();
    for (const item of category.items ?? []) {
      if (item.type === "resource") {
        if (resourceIds.has(item.id)) failures.push(`${context}: duplicate resource id ${item.id}`);
        resourceIds.add(item.id);
        if (!validIsoDate(item.last_verified)) failures.push(`${context}: ${item.id} needs a real last_verified date in YYYY-MM-DD`);
        for (const block of item.blocks ?? []) validateBlock(block, `${context}: ${item.id}`);
      } else {
        validateBlock(item, `${context}: ${category.id}`);
      }
    }
    resourcesByCategory.set(category.id, resourceIds);
  }
  const timeframes = ["tonight", "this_week", "this_month"];
  for (const timeframe of timeframes) {
    const references = city.quick_actions?.[timeframe];
    if (!Array.isArray(references)) {
      failures.push(`${context}: quick_actions.${timeframe} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const reference of references) {
      const key = `${reference.category_id}/${reference.entry_id}`;
      if (seen.has(key)) failures.push(`${context}: duplicate quick action ${timeframe} ${key}`);
      seen.add(key);
      if (!resourcesByCategory.get(reference.category_id)?.has(reference.entry_id)) failures.push(`${context}: quick action ${timeframe} points to missing entry ${key}`);
    }
  }
  for (const timeframe of Object.keys(city.quick_actions ?? {})) if (!timeframes.includes(timeframe)) failures.push(`${context}: unknown quick action timeframe ${timeframe}`);
  if (city.status === "published" && !(city.categories ?? []).some(visibleCategory)) failures.push(`${context}: a published city needs at least one non-empty category`);
}

function entryAnchor(categoryId, entryId) {
  return `${categoryId}--${entryId}`;
}

function renderResource(resource, category, city, ui, legacyAlias = false) {
  const blocks = resource.blocks.map((block) => renderBlock(block, "        ")).join("\n");
  return [
    `      <article class="resource" id="${escapeHtml(entryAnchor(category.id, resource.id))}">`,
    legacyAlias ? `        <span id="${escapeHtml(resource.id)}" class="anchor-alias" aria-hidden="true"></span>` : "",
    `        <h3>${escapeHtml(resource.name)}</h3>`,
    blocks,
    `        <p class="meta"><strong>${escapeHtml(ui.verified)}:</strong> ${escapeHtml(resource.last_verified)}</p>`,
    `        <p class="entry-report"><a href="${escapeHtml(issueUrl(city, `${category.id}/${resource.id}`))}">${escapeHtml(ui.report)}</a></p>`,
    "      </article>",
  ].filter(Boolean).join("\n");
}

function quickActions(city, categories, ui) {
  const entries = new Map();
  for (const category of categories) {
    for (const resource of category.items.filter((item) => item.type === "resource")) {
      entries.set(`${category.id}/${resource.id}`, { category, resource });
    }
  }
  return [
    { label: ui.tonight, references: city.quick_actions.tonight },
    { label: ui.week, references: city.quick_actions.this_week },
    { label: ui.month, references: city.quick_actions.this_month },
  ].map((group) => ({
    label: group.label,
    entries: group.references.map((reference) => entries.get(`${reference.category_id}/${reference.entry_id}`)).filter(Boolean),
  })).filter((group) => group.entries.length);
}

function renderQuickActions(city, categories, ui) {
  const groups = quickActions(city, categories, ui);
  if (!groups.length) return "";
  const body = groups.map((group) => [
    `      <h3>${escapeHtml(group.label)}</h3>`,
    "      <ul>",
    ...group.entries.map(({ category, resource }) => `        <li><a href="#${escapeHtml(entryAnchor(category.id, resource.id))}">${escapeHtml(resource.name)}</a></li>`),
    "      </ul>",
  ].join("\n")).join("\n");
  return [
    "    <section class=\"quick-help\" aria-labelledby=\"quick-help-title\">",
    `      <h2 id="quick-help-title">${escapeHtml(ui.quick)}</h2>`,
    body,
    "    </section>",
  ].join("\n");
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
  const urgent = city.page.urgent.map((block) => renderBlock(block, "    ")).join("\n");
  const intro = city.page.intro.map((block) => renderBlock(block, "    ")).join("\n");
  const contents = categories.map((category) => `        <li><a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a></li>`).join("\n");
  const reservedIds = new Set(["top", "main-content", "quick-help-title", "contents-title", ...categories.map((category) => category.id)]);
  const legacyOwners = new Map();
  for (const category of categories) {
    for (const resource of category.items.filter((item) => item.type === "resource")) {
      if (!reservedIds.has(resource.id) && !legacyOwners.has(resource.id)) legacyOwners.set(resource.id, `${category.id}/${resource.id}`);
    }
  }
  const sections = categories.map((category) => {
    const items = category.items.map((item) => item.type === "resource" ? renderResource(item, category, city, ui, legacyOwners.get(item.id) === `${category.id}/${item.id}`) : renderBlock(item, "      ")).join("\n");
    return [
      `    <section id="${escapeHtml(category.id)}">`,
      `      <h2>${escapeHtml(category.title)}</h2>`,
      items,
      `      <p class="back-to-top"><a href="#top">${escapeHtml(ui.back)}</a></p>`,
      "    </section>",
    ].join("\n");
  }).join("\n\n");
  const footerBlocks = city.page.footer.map((block) => renderBlock(block, "    ")).join("\n");
  const quick = renderQuickActions(city, categories, ui);
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
    NOTICE: renderInline(city.page.notice),
    INTRO: intro,
    QUICK_ACTIONS: quick,
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
